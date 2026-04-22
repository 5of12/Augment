import * as Tone from 'tone';
import type { AudioParams, RecipeType, ResolvedSynthEngine, SynthEngine, SynthOscillatorType } from '../types';
import {
  engineLabels,
  getActiveSampleBaseUrl,
  getActiveSampleUrls,
  getResolvedSampleRootNote,
  getSampleSelectionSignature,
  getSelectedSampleUrl,
  toNoisePlaybackRate,
  toPluckAttackNoise,
  toPluckDampeningFrequency,
  toAttackSeconds,
  toEnvelopeDecaySeconds,
  toFatSpreadCents,
  toFatVoiceCount,
  toFilterCutoffFrequency,
  toFilterQ,
  toGrainOverlapSeconds,
  toGrainSizeSeconds,
  toMonoFilterEnvelopeRange,
  toPolyDetuneCents,
  toPolyVoiceCount,
  toPortamentoSeconds,
  toReleaseSeconds
} from '../audioConfig';

export const globalAnalyser = new Tone.Analyser('waveform', 1024);
Tone.getDestination().connect(globalAnalyser);

type ManagedSynth =
  | Tone.Synth
  | Tone.MonoSynth
  | Tone.PolySynth<any>
  | Tone.PluckSynth
  | Tone.NoiseSynth
  | Tone.MembraneSynth
  | Tone.MetalSynth
  | Tone.FMSynth
  | Tone.AMSynth
  | Tone.DuoSynth
  | Tone.Sampler;

type PerformanceSynth = Tone.PolySynth<any>;
type VoiceConstructor =
  | typeof Tone.Synth
  | typeof Tone.MonoSynth
  | typeof Tone.FMSynth
  | typeof Tone.AMSynth
  | typeof Tone.MembraneSynth
  | typeof Tone.MetalSynth
  | typeof Tone.DuoSynth;

interface OutputChain {
  filter: Tone.Filter;
  cleanupHighpass: Tone.Filter;
  limiter: Tone.Limiter;
}

interface PolyPerformanceState extends OutputChain {
  kind: 'poly';
  synth: PerformanceSynth;
  engine: ResolvedSynthEngine;
  recipe: RecipeType;
  signature: string;
  params: AudioParams;
}

interface SamplerPerformanceState extends OutputChain {
  kind: 'sampler';
  sampler: Tone.Sampler;
  engine: 'sampler';
  recipe: RecipeType;
  signature: string;
  params: AudioParams;
}

interface GrainVoice {
  player: Tone.GrainPlayer;
  gain: Tone.Gain;
  disposeTimer: ReturnType<typeof setTimeout> | null;
}

interface GrainPerformanceState extends OutputChain {
  kind: 'grain';
  engine: 'grain';
  recipe: RecipeType;
  signature: string;
  params: AudioParams;
  voices: Map<number, GrainVoice>;
}

type InstrumentVoiceSynth = Tone.PluckSynth | Tone.NoiseSynth;

interface InstrumentVoice {
  synth: InstrumentVoiceSynth;
  gain: Tone.Gain;
  disposeTimer: ReturnType<typeof setTimeout> | null;
}

interface InstrumentPerformanceState extends OutputChain {
  kind: 'instrument';
  engine: 'pluck' | 'noise';
  recipe: RecipeType;
  signature: string;
  params: AudioParams;
  voices: Map<number, InstrumentVoice>;
}

type PerformanceState = PolyPerformanceState | SamplerPerformanceState | GrainPerformanceState | InstrumentPerformanceState;

const recipeEngineMap: Record<RecipeType, ResolvedSynthEngine> = {
  tap: 'membrane',
  click: 'metal',
  bloop: 'fm',
  chirp: 'am',
  success: 'polyfm',
  error: 'duo'
};

const performanceVoiceMap: Partial<Record<ResolvedSynthEngine, VoiceConstructor>> = {
  synth: Tone.Synth,
  mono: Tone.MonoSynth,
  fm: Tone.FMSynth,
  am: Tone.AMSynth,
  poly: Tone.Synth,
  fat: Tone.Synth,
  membrane: Tone.MembraneSynth,
  metal: Tone.MetalSynth,
  duo: Tone.DuoSynth,
  polyfm: Tone.FMSynth
};

let activeSynth: ManagedSynth | null = null;
let activeFilter: Tone.Filter | null = null;
let currentRecipe: RecipeType | null = null;
let activeEngine: ResolvedSynthEngine | null = null;
let performanceState: PerformanceState | null = null;

const getPitchFrequency = (pitch: number) => pitch * 2000 + 100;
const getTriggerDuration = (decay: number) => 0.05 + decay * 0.95;
const getFilterFrequency = (filterCutoff: number) => toFilterCutoffFrequency(filterCutoff);
const getEnvelope = (params: AudioParams) => ({
  attack: toAttackSeconds(params.attack),
  decay: toEnvelopeDecaySeconds(params.envelopeDecay),
  sustain: params.sustain,
  release: toReleaseSeconds(params.release)
});
const getModulationEnvelope = (params: AudioParams) => {
  const envelope = getEnvelope(params);
  return {
    attack: Math.max(0.001, envelope.attack * 0.75),
    decay: envelope.decay,
    sustain: Math.min(envelope.sustain, 0.45),
    release: Math.max(0.02, envelope.release * 0.85)
  };
};
const getHarmonicity = (value: number) => 0.5 + value * 4.5;
const getModulationIndex = (value: number) => 1 + value * 14;
const getMembranePitchDecay = (brightness: number) => 0.01 + brightness * 0.2;
const getMembraneOctaves = (character: number) => 1 + character * 8;
const getMetalHarmonicity = (brightness: number) => 1 + brightness * 7;
const getMetalModulationIndex = (character: number) => 8 + character * 60;
const getMetalResonance = (params: AudioParams) => 800 + params.filterQ * 5500;
const getDuoHarmonicity = (brightness: number) => 0.75 + brightness * 0.9;
const getVibratoRate = (brightness: number) => 3 + brightness * 6;
const getAmDepth = (character: number) => 0.25 + character * 0.75;
const toToneNote = (midi: number) => Tone.Frequency(midi, 'midi').toNote();

const getFatOscillatorType = (oscillatorType: SynthOscillatorType) => {
  if (oscillatorType === 'fatsine' || oscillatorType === 'fatsquare' || oscillatorType === 'fattriangle' || oscillatorType === 'fatsawtooth') {
    return oscillatorType;
  }

  switch (oscillatorType) {
    case 'sine':
      return 'fatsine';
    case 'square':
      return 'fatsquare';
    case 'triangle':
      return 'fattriangle';
    case 'pulse':
      return 'fatsquare';
    case 'sawtooth':
    default:
      return 'fatsawtooth';
  }
};

const getSampleRootMidi = (params: AudioParams) => Tone.Frequency(getResolvedSampleRootNote(params)).toMidi();

const getDetuneCentsForTarget = (target: number | string, params: AudioParams) => {
  const targetMidi = Tone.Frequency(target).toMidi();
  return (targetMidi - getSampleRootMidi(params)) * 100;
};

const createOutputChain = (params: AudioParams): OutputChain => {
  const filter = new Tone.Filter(getFilterFrequency(params.filterCutoff), params.filterType);
  filter.Q.value = toFilterQ(params.filterQ);

  const cleanupHighpass = new Tone.Filter(30, 'highpass');
  const limiter = new Tone.Limiter(-3);

  filter.connect(cleanupHighpass);
  cleanupHighpass.connect(limiter);
  limiter.connect(Tone.getDestination());

  return { filter, cleanupHighpass, limiter };
};

const disposeOutputChain = (chain: OutputChain) => {
  chain.filter.dispose();
  chain.cleanupHighpass.dispose();
  chain.limiter.dispose();
};

const applyFilterSettings = (filter: Tone.Filter, params: AudioParams) => {
  filter.frequency.rampTo(getFilterFrequency(params.filterCutoff), 0.05);
  filter.Q.rampTo(toFilterQ(params.filterQ), 0.05);
  filter.type = params.filterType;
};

const getPrimaryRecipeFrequency = (recipe: RecipeType, pitchFrequency: number) => {
  switch (recipe) {
    case 'tap':
      return pitchFrequency * 0.22;
    case 'click':
      return pitchFrequency * 1.8;
    case 'error':
      return pitchFrequency * 0.62;
    default:
      return pitchFrequency;
  }
};

const getRecipeOffset = (recipe: RecipeType) => {
  switch (recipe) {
    case 'success':
      return 0.18;
    case 'error':
      return 0.22;
    default:
      return 0;
  }
};

const getPerformanceSignature = (engine: ResolvedSynthEngine, params: AudioParams) =>
  engine === 'sampler' || engine === 'grain' ? `${engine}:${getSampleSelectionSignature(params)}` : engine;

const getPerformanceMaxPolyphony = (engine: ResolvedSynthEngine, params: AudioParams) => {
  switch (engine) {
    case 'poly':
      return Math.max(4, toPolyVoiceCount(params.character) * 2);
    case 'fat':
      return Math.max(4, toFatVoiceCount(params.character) * 2);
    case 'polyfm':
      return 10;
    case 'metal':
      return 6;
    default:
      return 12;
  }
};

const applyFrequencySweep = (
  synth: ManagedSynth,
  startFrequency: number,
  endFrequency: number,
  time: number,
  endTime: number
) => {
  if (synth instanceof Tone.PolySynth || synth instanceof Tone.Sampler) return;
  if (!('frequency' in synth) || !synth.frequency) return;
  synth.frequency.setValueAtTime(startFrequency, time);
  synth.frequency.exponentialRampToValueAtTime(endFrequency, endTime);
};

const triggerNote = (synth: ManagedSynth, note: number | string, duration: number, time: number, velocity = 1) => {
  if (synth instanceof Tone.PluckSynth) {
    synth.triggerAttack(note as any, time);
    synth.triggerRelease(time + duration);
    return;
  }

  if (synth instanceof Tone.NoiseSynth) {
    synth.triggerAttackRelease(duration, time, velocity);
    return;
  }

  synth.triggerAttackRelease(note as any, duration, time, velocity);
};

const triggerRecipePattern = (
  synth: ManagedSynth,
  recipe: RecipeType,
  pitchFrequency: number,
  triggerDuration: number,
  time: number
) => {
  switch (recipe) {
    case 'tap':
      triggerNote(synth, getPrimaryRecipeFrequency(recipe, pitchFrequency), Math.max(0.05, triggerDuration * 0.65), time);
      break;
    case 'click':
      triggerNote(synth, getPrimaryRecipeFrequency(recipe, pitchFrequency), Math.max(0.04, triggerDuration * 0.25), time);
      break;
    case 'bloop':
      applyFrequencySweep(synth, pitchFrequency * 1.5, pitchFrequency * 0.25, time, time + triggerDuration);
      triggerNote(synth, pitchFrequency, triggerDuration, time);
      break;
    case 'chirp':
      applyFrequencySweep(synth, pitchFrequency * 0.55, pitchFrequency * 2, time, time + triggerDuration * 0.5);
      triggerNote(synth, pitchFrequency, Math.max(0.08, triggerDuration * 0.8), time);
      break;
    case 'success':
      triggerNote(synth, pitchFrequency, Math.max(0.12, triggerDuration * 0.35), time);
      triggerNote(synth, pitchFrequency * 1.5, Math.max(0.18, triggerDuration * 0.6), time + 0.14);
      break;
    case 'error':
      triggerNote(synth, getPrimaryRecipeFrequency(recipe, pitchFrequency), Math.max(0.12, triggerDuration * 0.5), time);
      triggerNote(synth, pitchFrequency * 0.42, Math.max(0.2, triggerDuration * 0.75), time + 0.18);
      break;
  }
};

const getEngineOptions = (engine: ResolvedSynthEngine, params: AudioParams) => {
  const envelope = getEnvelope(params);
  const modulationEnvelope = getModulationEnvelope(params);

  switch (engine) {
    case 'mono':
      return {
        portamento: toPortamentoSeconds(params.character),
        oscillator: { type: params.oscillatorType },
        envelope,
        filter: {
          type: params.filterType,
          frequency: Math.max(120, getFilterFrequency(params.filterCutoff) * 0.85),
          Q: toFilterQ(params.filterQ)
        },
        filterEnvelope: {
          attack: Math.max(0.001, envelope.attack * 0.8),
          decay: envelope.decay,
          sustain: Math.min(0.75, params.sustain),
          release: envelope.release,
          baseFrequency: Math.max(80, getFilterFrequency(params.filterCutoff) * 0.35),
          octaves: toMonoFilterEnvelopeRange(params.brightness)
        }
      };
    case 'fm':
      return {
        harmonicity: getHarmonicity(params.character),
        modulationIndex: getModulationIndex(params.brightness),
        oscillator: { type: params.oscillatorType },
        modulation: { type: params.modulationType },
        envelope,
        modulationEnvelope
      };
    case 'am':
      return {
        harmonicity: getHarmonicity(params.brightness),
        oscillator: { type: params.oscillatorType },
        modulation: { type: params.modulationType },
        envelope,
        modulationEnvelope: {
          ...modulationEnvelope,
          sustain: Math.min(0.95, getAmDepth(params.character))
        }
      };
    case 'poly':
      return {
        detune: toPolyDetuneCents(params.brightness),
        oscillator: { type: params.oscillatorType },
        envelope
      };
    case 'fat':
      return {
        oscillator: {
          type: getFatOscillatorType(params.oscillatorType) as any,
          spread: toFatSpreadCents(params.brightness),
          count: toFatVoiceCount(params.character)
        },
        envelope
      };
    case 'pluck':
      return {
        attackNoise: toPluckAttackNoise(params.pluckAttackNoise),
        dampening: toPluckDampeningFrequency(params.pluckDampening),
        resonance: params.pluckResonance,
        release: toReleaseSeconds(params.release)
      };
    case 'noise':
      return {
        envelope,
        noise: {
          type: params.noiseType,
          playbackRate: toNoisePlaybackRate(params.noisePlaybackRate)
        }
      };
    case 'membrane':
      return {
        pitchDecay: getMembranePitchDecay(params.brightness),
        octaves: getMembraneOctaves(params.character),
        oscillator: { type: params.oscillatorType },
        envelope
      };
    case 'metal':
      return {
        envelope,
        harmonicity: getMetalHarmonicity(params.brightness),
        modulationIndex: getMetalModulationIndex(params.character),
        resonance: getMetalResonance(params),
        octaves: 1.2 + params.character * 2
      };
    case 'duo':
      return {
        vibratoAmount: params.character * 0.5,
        vibratoRate: getVibratoRate(params.brightness),
        volume: -16,
        harmonicity: getDuoHarmonicity(params.brightness),
        voice0: { oscillator: { type: params.oscillatorType }, envelope },
        voice1: { oscillator: { type: params.modulationType }, envelope }
      };
    case 'polyfm':
      return {
        harmonicity: Math.max(0.75, getHarmonicity(params.character)),
        modulationIndex: Math.max(1, getModulationIndex(params.brightness) * 0.6),
        oscillator: { type: params.oscillatorType },
        modulation: { type: params.modulationType },
        envelope,
        modulationEnvelope
      };
    case 'sampler':
      return {
        attack: toAttackSeconds(params.attack),
        release: toReleaseSeconds(params.release),
        curve: 'exponential' as const
      };
    case 'synth':
    default:
      return {
        oscillator: { type: params.oscillatorType },
        envelope
      };
  }
};

const createSampler = async (params: AudioParams) => {
  const sampler = new Tone.Sampler({
    urls: getActiveSampleUrls(params),
    baseUrl: getActiveSampleBaseUrl(params),
    attack: toAttackSeconds(params.attack),
    release: toReleaseSeconds(params.release),
    curve: 'exponential'
  });
  await Tone.loaded();
  return sampler;
};

const createOneShotSynth = async (engine: ResolvedSynthEngine, params: AudioParams): Promise<ManagedSynth> => {
  const options = getEngineOptions(engine, params);

  switch (engine) {
    case 'mono':
      return new Tone.MonoSynth(options as ConstructorParameters<typeof Tone.MonoSynth>[0]);
    case 'fm':
      return new Tone.FMSynth(options as ConstructorParameters<typeof Tone.FMSynth>[0]);
    case 'am':
      return new Tone.AMSynth(options as ConstructorParameters<typeof Tone.AMSynth>[0]);
    case 'poly':
      return new Tone.PolySynth(Tone.Synth, options as ConstructorParameters<typeof Tone.Synth>[0]);
    case 'fat':
      return new Tone.PolySynth(Tone.Synth, options as ConstructorParameters<typeof Tone.Synth>[0]);
    case 'pluck':
      return new Tone.PluckSynth(options as ConstructorParameters<typeof Tone.PluckSynth>[0]);
    case 'noise':
      return new Tone.NoiseSynth(options as ConstructorParameters<typeof Tone.NoiseSynth>[0]);
    case 'membrane':
      return new Tone.MembraneSynth(options as ConstructorParameters<typeof Tone.MembraneSynth>[0]);
    case 'metal':
      return new Tone.MetalSynth(options as ConstructorParameters<typeof Tone.MetalSynth>[0]);
    case 'duo':
      return new Tone.DuoSynth(options as ConstructorParameters<typeof Tone.DuoSynth>[0]);
    case 'polyfm':
      return new Tone.PolySynth(Tone.FMSynth, options as ConstructorParameters<typeof Tone.FMSynth>[0]);
    case 'sampler':
      return createSampler(params);
    case 'synth':
    default:
      return new Tone.Synth(options as ConstructorParameters<typeof Tone.Synth>[0]);
  }
};

const createGrainVoice = async (
  params: AudioParams,
  note: number | string,
  destination: Tone.Filter,
  velocity: number,
  loop: boolean,
  startTime: number
) => {
  const gain = new Tone.Gain(0);
  const player = new Tone.GrainPlayer({
    url: getSelectedSampleUrl(params),
    grainSize: toGrainSizeSeconds(params.brightness),
    overlap: toGrainOverlapSeconds(params.character),
    loop
  });

  player.connect(gain);
  gain.connect(destination);

  await Tone.loaded();

  player.detune = getDetuneCentsForTarget(note, params);

  const attack = Math.max(0.005, toAttackSeconds(params.attack));
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(Math.max(0.05, velocity), startTime + attack);

  return { player, gain, disposeTimer: null } satisfies GrainVoice;
};

const scheduleGrainVoiceRelease = (voice: GrainVoice, params: AudioParams) => {
  const now = Tone.now();
  const release = Math.max(0.03, toReleaseSeconds(params.release));

  if (voice.disposeTimer !== null) {
    clearTimeout(voice.disposeTimer);
  }

  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now);
  voice.gain.gain.linearRampToValueAtTime(0.0001, now + release);
  voice.player.stop(now + release + 0.05);

  voice.disposeTimer = setTimeout(() => {
    voice.player.dispose();
    voice.gain.dispose();
  }, Math.ceil((release + 0.08) * 1000));
};

const disposeGrainVoice = (voice: GrainVoice) => {
  if (voice.disposeTimer !== null) {
    clearTimeout(voice.disposeTimer);
  }

  try {
    voice.player.stop();
  } catch {
    // Ignore stop calls on voices which have already ended.
  }

  voice.player.dispose();
  voice.gain.dispose();
};

const createInstrumentVoice = (
  engine: 'pluck' | 'noise',
  params: AudioParams,
  destination: Tone.Filter,
  velocity: number
): InstrumentVoice => {
  const gain = new Tone.Gain(engine === 'pluck' ? Math.max(0.05, velocity) : 1);
  const synth =
    engine === 'pluck'
      ? new Tone.PluckSynth(getEngineOptions(engine, params) as ConstructorParameters<typeof Tone.PluckSynth>[0])
      : new Tone.NoiseSynth(getEngineOptions(engine, params) as ConstructorParameters<typeof Tone.NoiseSynth>[0]);

  synth.connect(gain);
  gain.connect(destination);

  return {
    synth,
    gain,
    disposeTimer: null
  };
};

const applyInstrumentVoiceSettings = (voice: InstrumentVoice, engine: 'pluck' | 'noise', params: AudioParams) => {
  if (engine === 'pluck' && voice.synth instanceof Tone.PluckSynth) {
    voice.synth.attackNoise = toPluckAttackNoise(params.pluckAttackNoise);
    voice.synth.dampening = toPluckDampeningFrequency(params.pluckDampening);
    voice.synth.resonance = params.pluckResonance;
    voice.synth.release = toReleaseSeconds(params.release);
    return;
  }

  if (engine === 'noise' && voice.synth instanceof Tone.NoiseSynth) {
    voice.synth.noise.type = params.noiseType;
    voice.synth.noise.playbackRate = toNoisePlaybackRate(params.noisePlaybackRate);
    voice.synth.envelope.attack = toAttackSeconds(params.attack);
    voice.synth.envelope.decay = toEnvelopeDecaySeconds(params.envelopeDecay);
    voice.synth.envelope.sustain = params.sustain;
    voice.synth.envelope.release = toReleaseSeconds(params.release);
  }
};

const triggerInstrumentVoiceAttack = (
  voice: InstrumentVoice,
  engine: 'pluck' | 'noise',
  note: string,
  time: number,
  velocity: number
) => {
  if (engine === 'pluck' && voice.synth instanceof Tone.PluckSynth) {
    voice.synth.triggerAttack(note, time);
    return;
  }

  if (engine === 'noise' && voice.synth instanceof Tone.NoiseSynth) {
    voice.synth.triggerAttack(time, velocity);
  }
};

const scheduleInstrumentVoiceRelease = (
  voice: InstrumentVoice,
  engine: 'pluck' | 'noise',
  params: AudioParams,
  time: number = Tone.now()
) => {
  if (voice.disposeTimer !== null) {
    clearTimeout(voice.disposeTimer);
  }

  if (engine === 'pluck' && voice.synth instanceof Tone.PluckSynth) {
    voice.synth.triggerRelease(time);
  } else if (engine === 'noise' && voice.synth instanceof Tone.NoiseSynth) {
    voice.synth.triggerRelease(time);
  }

  const release = Math.max(0.04, toReleaseSeconds(params.release));
  voice.disposeTimer = setTimeout(() => {
    voice.synth.dispose();
    voice.gain.dispose();
  }, Math.ceil((release + 0.08) * 1000));
};

const disposeInstrumentVoice = (voice: InstrumentVoice) => {
  if (voice.disposeTimer !== null) {
    clearTimeout(voice.disposeTimer);
  }

  voice.synth.dispose();
  voice.gain.dispose();
};

const buildGrainRecipeGraph = async (recipe: RecipeType, params: AudioParams, time: number, isOffline: boolean) => {
  const pitchFrequency = getPitchFrequency(params.pitch);
  const triggerDuration = getTriggerDuration(params.decay);
  const chain = createOutputChain(params);

  const scheduleNote = async (note: number, duration: number, startTime: number) => {
    const voice = await createGrainVoice(params, note, chain.filter, 0.92, true, startTime);
    voice.player.start(startTime);
    voice.gain.gain.setValueAtTime(0.92, startTime + duration);
    voice.gain.gain.linearRampToValueAtTime(0.0001, startTime + duration + toReleaseSeconds(params.release));
    voice.player.stop(startTime + duration + toReleaseSeconds(params.release) + 0.05);

    if (!isOffline) {
      setTimeout(() => {
        voice.player.dispose();
        voice.gain.dispose();
      }, Math.ceil((startTime + duration + toReleaseSeconds(params.release) - Tone.now() + 0.15) * 1000));
    }
  };

  switch (recipe) {
    case 'tap':
      await scheduleNote(getPrimaryRecipeFrequency(recipe, pitchFrequency), Math.max(0.05, triggerDuration * 0.65), time);
      break;
    case 'click':
      await scheduleNote(getPrimaryRecipeFrequency(recipe, pitchFrequency), Math.max(0.04, triggerDuration * 0.25), time);
      break;
    case 'bloop':
      await scheduleNote(pitchFrequency * 1.2, triggerDuration, time);
      break;
    case 'chirp':
      await scheduleNote(pitchFrequency * 1.4, Math.max(0.08, triggerDuration * 0.8), time);
      break;
    case 'success':
      await scheduleNote(pitchFrequency, Math.max(0.12, triggerDuration * 0.35), time);
      await scheduleNote(pitchFrequency * 1.5, Math.max(0.18, triggerDuration * 0.6), time + 0.14);
      break;
    case 'error':
      await scheduleNote(getPrimaryRecipeFrequency(recipe, pitchFrequency), Math.max(0.12, triggerDuration * 0.5), time);
      await scheduleNote(pitchFrequency * 0.42, Math.max(0.2, triggerDuration * 0.75), time + 0.18);
      break;
  }

  if (!isOffline) {
    activeSynth = null;
    activeFilter = chain.filter;
    currentRecipe = recipe;
    activeEngine = 'grain';

    setTimeout(() => {
      if (activeFilter === chain.filter) activeFilter = null;
      if (currentRecipe === recipe) currentRecipe = null;
      if (activeEngine === 'grain') activeEngine = null;
      disposeOutputChain(chain);
    }, Math.ceil(getRenderDuration(recipe, params) * 1000));
  }
};

const disposePerformanceState = () => {
  if (!performanceState) return;

  if (performanceState.kind === 'poly') {
    performanceState.synth.releaseAll();
    performanceState.synth.dispose();
  } else if (performanceState.kind === 'sampler') {
    performanceState.sampler.releaseAll();
    performanceState.sampler.dispose();
  } else if (performanceState.kind === 'instrument') {
    for (const voice of performanceState.voices.values()) {
      disposeInstrumentVoice(voice);
    }
    performanceState.voices.clear();
  } else {
    for (const voice of performanceState.voices.values()) {
      disposeGrainVoice(voice);
    }
    performanceState.voices.clear();
  }

  disposeOutputChain(performanceState);
  performanceState = null;
};

const createPerformancePolySynth = (engine: ResolvedSynthEngine, params: AudioParams, destination: Tone.Filter) => {
  const VoiceConstructor = performanceVoiceMap[engine];
  if (!VoiceConstructor) {
    throw new Error(`Unsupported performance engine: ${engine}`);
  }

  const synth = new Tone.PolySynth(VoiceConstructor as any, getEngineOptions(engine, params) as any).connect(destination) as PerformanceSynth;
  synth.maxPolyphony = getPerformanceMaxPolyphony(engine, params);
  return synth;
};

const rebuildPerformanceState = async (recipe: RecipeType, params: AudioParams) => {
  const engine = getResolvedEngine(recipe, params.engine);
  const signature = getPerformanceSignature(engine, params);

  disposePerformanceState();

  const chain = createOutputChain(params);

  if (engine === 'sampler') {
    const sampler = await createSampler(params);
    sampler.connect(chain.filter);
    performanceState = {
      kind: 'sampler',
      sampler,
      engine,
      recipe,
      signature,
      params: { ...params },
      ...chain
    };
    return;
  }

  if (engine === 'grain') {
    performanceState = {
      kind: 'grain',
      engine,
      recipe,
      signature,
      params: { ...params },
      voices: new Map(),
      ...chain
    };
    return;
  }

  if (engine === 'pluck' || engine === 'noise') {
    performanceState = {
      kind: 'instrument',
      engine,
      recipe,
      signature,
      params: { ...params },
      voices: new Map(),
      ...chain
    };
    return;
  }

  const synth = createPerformancePolySynth(engine, params, chain.filter);

  performanceState = {
    kind: 'poly',
    synth,
    engine,
    recipe,
    signature,
    params: { ...params },
    ...chain
  };
};

export const getResolvedEngine = (recipe: RecipeType, selectedEngine: SynthEngine): ResolvedSynthEngine =>
  selectedEngine === 'auto' ? recipeEngineMap[recipe] : selectedEngine;

export const getEngineTypeForRecipe = (recipe: RecipeType, selectedEngine: SynthEngine): string =>
  engineLabels[getResolvedEngine(recipe, selectedEngine)];

export const getRenderDuration = (recipe: RecipeType, params: AudioParams) => {
  const envelope = getEnvelope(params);
  return Math.max(
    1.2,
    getTriggerDuration(params.decay) + envelope.attack + envelope.decay + envelope.release + getRecipeOffset(recipe) + 0.4
  );
};

const getPerformanceNoteHoldDuration = (params: AudioParams) => Math.max(0.22, getTriggerDuration(params.decay));

export const getPerformanceNoteRenderDuration = (params: AudioParams) => {
  const envelope = getEnvelope(params);
  return Math.max(1.2, getPerformanceNoteHoldDuration(params) + envelope.attack + envelope.decay + envelope.release + 0.4);
};

export const updateActiveParams = (params: AudioParams) => {
  if (!activeFilter || !currentRecipe || !activeEngine) return;
  if (activeEngine !== getResolvedEngine(currentRecipe, params.engine)) return;

  applyFilterSettings(activeFilter, params);

  if (!activeSynth) return;

  const pitchFrequency = getPitchFrequency(params.pitch);
  const primaryFrequency = getPrimaryRecipeFrequency(currentRecipe, pitchFrequency);
  const oneShotOptions = getEngineOptions(activeEngine, params);

  try {
    switch (activeEngine) {
      case 'sampler':
        if (activeSynth instanceof Tone.Sampler) {
          activeSynth.attack = toAttackSeconds(params.attack);
          activeSynth.release = toReleaseSeconds(params.release);
        }
        break;
      case 'metal':
        if (activeSynth instanceof Tone.MetalSynth) {
          activeSynth.frequency.rampTo(primaryFrequency, 0.05);
          activeSynth.set(oneShotOptions as Parameters<Tone.MetalSynth['set']>[0]);
        }
        break;
      case 'membrane':
        if (activeSynth instanceof Tone.MembraneSynth) {
          activeSynth.frequency.rampTo(primaryFrequency, 0.05);
          activeSynth.set(oneShotOptions as Parameters<Tone.MembraneSynth['set']>[0]);
        }
        break;
      case 'fm':
        if (activeSynth instanceof Tone.FMSynth) {
          if (currentRecipe !== 'bloop') activeSynth.frequency.rampTo(primaryFrequency, 0.05);
          activeSynth.set(oneShotOptions as Parameters<Tone.FMSynth['set']>[0]);
        }
        break;
      case 'am':
        if (activeSynth instanceof Tone.AMSynth) {
          if (currentRecipe !== 'chirp') activeSynth.frequency.rampTo(primaryFrequency, 0.05);
          activeSynth.set(oneShotOptions as Parameters<Tone.AMSynth['set']>[0]);
        }
        break;
      case 'poly':
      case 'fat':
      case 'polyfm':
        if (activeSynth instanceof Tone.PolySynth) {
          activeSynth.set(oneShotOptions as Parameters<Tone.PolySynth<any>['set']>[0]);
          activeSynth.maxPolyphony = getPerformanceMaxPolyphony(activeEngine, params);
        }
        break;
      case 'pluck':
        if (activeSynth instanceof Tone.PluckSynth) {
          activeSynth.attackNoise = toPluckAttackNoise(params.pluckAttackNoise);
          activeSynth.dampening = toPluckDampeningFrequency(params.pluckDampening);
          activeSynth.resonance = params.pluckResonance;
          activeSynth.release = toReleaseSeconds(params.release);
        }
        break;
      case 'noise':
        if (activeSynth instanceof Tone.NoiseSynth) {
          activeSynth.noise.type = params.noiseType;
          activeSynth.noise.playbackRate = toNoisePlaybackRate(params.noisePlaybackRate);
          activeSynth.envelope.attack = toAttackSeconds(params.attack);
          activeSynth.envelope.decay = toEnvelopeDecaySeconds(params.envelopeDecay);
          activeSynth.envelope.sustain = params.sustain;
          activeSynth.envelope.release = toReleaseSeconds(params.release);
        }
        break;
      case 'duo':
        if (activeSynth instanceof Tone.DuoSynth) {
          if (currentRecipe !== 'error') activeSynth.frequency.rampTo(primaryFrequency, 0.05);
          activeSynth.set(oneShotOptions as Parameters<Tone.DuoSynth['set']>[0]);
        }
        break;
      case 'mono':
        if (activeSynth instanceof Tone.MonoSynth) {
          if (currentRecipe !== 'bloop' && currentRecipe !== 'chirp') activeSynth.frequency.rampTo(primaryFrequency, 0.05);
          activeSynth.set(oneShotOptions as Parameters<Tone.MonoSynth['set']>[0]);
        }
        break;
      case 'synth':
        if (activeSynth instanceof Tone.Synth) {
          if (currentRecipe !== 'bloop' && currentRecipe !== 'chirp') activeSynth.frequency.rampTo(primaryFrequency, 0.05);
          activeSynth.set(oneShotOptions as Parameters<Tone.Synth['set']>[0]);
        }
        break;
      case 'grain':
        break;
    }
  } catch {
    // Ignore errors if the active node is disposed during a rapid control update.
  }
};

export const updatePerformanceInstrument = async (recipe: RecipeType, params: AudioParams) => {
  const engine = getResolvedEngine(recipe, params.engine);
  const signature = getPerformanceSignature(engine, params);

  if (!performanceState || performanceState.engine !== engine || performanceState.signature !== signature) {
    await rebuildPerformanceState(recipe, params);
    return;
  }

  performanceState.recipe = recipe;
  performanceState.params = { ...params };
  applyFilterSettings(performanceState.filter, params);

  if (performanceState.kind === 'poly') {
    performanceState.synth.set(getEngineOptions(engine, params) as Parameters<Tone.PolySynth<any>['set']>[0]);
    performanceState.synth.maxPolyphony = getPerformanceMaxPolyphony(engine, params);
    return;
  }

  if (performanceState.kind === 'sampler') {
    performanceState.sampler.attack = toAttackSeconds(params.attack);
    performanceState.sampler.release = toReleaseSeconds(params.release);
    return;
  }

  if (performanceState.kind === 'instrument') {
    for (const voice of performanceState.voices.values()) {
      applyInstrumentVoiceSettings(voice, performanceState.engine, params);
    }
    return;
  }

  for (const voice of performanceState.voices.values()) {
    voice.player.grainSize = toGrainSizeSeconds(params.brightness);
    voice.player.overlap = toGrainOverlapSeconds(params.character);
  }
};

export const teardownPerformanceInstrument = () => {
  disposePerformanceState();
};

export const triggerPerformanceNote = async (recipe: RecipeType, params: AudioParams, midi: number, velocity = 0.9) => {
  await Tone.start();
  await updatePerformanceInstrument(recipe, params);

  if (!performanceState) return;

  const note = toToneNote(midi);
  const now = Tone.now();

  if (performanceState.kind === 'poly') {
    performanceState.synth.triggerAttack(note, now, velocity);
    return;
  }

  if (performanceState.kind === 'sampler') {
    performanceState.sampler.triggerAttack(note, now, velocity);
    return;
  }

  if (performanceState.kind === 'instrument') {
    const existingVoice = performanceState.voices.get(midi);
    if (existingVoice) {
      disposeInstrumentVoice(existingVoice);
      performanceState.voices.delete(midi);
    }

    const voice = createInstrumentVoice(performanceState.engine, params, performanceState.filter, velocity);
    applyInstrumentVoiceSettings(voice, performanceState.engine, params);
    triggerInstrumentVoiceAttack(voice, performanceState.engine, note, now, velocity);
    performanceState.voices.set(midi, voice);
    return;
  }

  const existingVoice = performanceState.voices.get(midi);
  if (existingVoice) {
    disposeGrainVoice(existingVoice);
    performanceState.voices.delete(midi);
  }

  const voice = await createGrainVoice(params, note, performanceState.filter, velocity, true, now);

  if (!performanceState || performanceState.kind !== 'grain') {
    disposeGrainVoice(voice);
    return;
  }

  voice.player.start(now);
  performanceState.voices.set(midi, voice);
};

export const releasePerformanceNote = (midi: number) => {
  if (!performanceState) return;

  const note = toToneNote(midi);

  if (performanceState.kind === 'poly') {
    performanceState.synth.triggerRelease(note, Tone.now());
    return;
  }

  if (performanceState.kind === 'sampler') {
    performanceState.sampler.triggerRelease(note, Tone.now());
    return;
  }

  if (performanceState.kind === 'instrument') {
    const voice = performanceState.voices.get(midi);
    if (!voice) return;
    performanceState.voices.delete(midi);
    scheduleInstrumentVoiceRelease(voice, performanceState.engine, performanceState.params);
    return;
  }

  const voice = performanceState.voices.get(midi);
  if (!voice) return;
  performanceState.voices.delete(midi);
  scheduleGrainVoiceRelease(voice, performanceState.params);
};

export const releaseAllPerformanceNotes = () => {
  if (!performanceState) return;

  if (performanceState.kind === 'poly') {
    performanceState.synth.releaseAll(Tone.now());
    return;
  }

  if (performanceState.kind === 'sampler') {
    performanceState.sampler.releaseAll(Tone.now());
    return;
  }

  if (performanceState.kind === 'instrument') {
    for (const [midi, voice] of performanceState.voices.entries()) {
      performanceState.voices.delete(midi);
      scheduleInstrumentVoiceRelease(voice, performanceState.engine, performanceState.params);
    }
    return;
  }

  for (const [midi, voice] of performanceState.voices.entries()) {
    performanceState.voices.delete(midi);
    scheduleGrainVoiceRelease(voice, performanceState.params);
  }
};

export const buildPerformanceNoteGraph = async (
  recipe: RecipeType,
  params: AudioParams,
  midi: number,
  velocity: number,
  time: number,
  isOffline: boolean
) => {
  const engine = getResolvedEngine(recipe, params.engine);
  const note = toToneNote(midi);
  const holdDuration = getPerformanceNoteHoldDuration(params);
  const chain = createOutputChain(params);
  const releaseDuration = toReleaseSeconds(params.release);

  if (engine === 'pluck' || engine === 'noise') {
    const voice = createInstrumentVoice(engine, params, chain.filter, velocity);
    applyInstrumentVoiceSettings(voice, engine, params);
    triggerInstrumentVoiceAttack(voice, engine, note, time, velocity);

    if (engine === 'pluck' && voice.synth instanceof Tone.PluckSynth) {
      voice.synth.triggerRelease(time + holdDuration);
    } else if (engine === 'noise' && voice.synth instanceof Tone.NoiseSynth) {
      voice.synth.triggerRelease(time + holdDuration);
    }

    if (!isOffline) {
      setTimeout(() => {
        disposeInstrumentVoice(voice);
        disposeOutputChain(chain);
      }, Math.ceil(getPerformanceNoteRenderDuration(params) * 1000));
    }
    return;
  }

  if (engine === 'sampler') {
    const sampler = await createSampler(params);
    sampler.connect(chain.filter);
    sampler.triggerAttack(note, time, velocity);
    sampler.triggerRelease(note, time + holdDuration);

    if (!isOffline) {
      const lifetimeMs = Math.ceil(getPerformanceNoteRenderDuration(params) * 1000);
      setTimeout(() => {
        sampler.dispose();
        disposeOutputChain(chain);
      }, lifetimeMs);
    }
    return;
  }

  if (engine === 'grain') {
    const voice = await createGrainVoice(params, note, chain.filter, velocity, true, time);
    voice.player.start(time);
    voice.gain.gain.setValueAtTime(Math.max(0.05, velocity), time + holdDuration);
    voice.gain.gain.linearRampToValueAtTime(0.0001, time + holdDuration + releaseDuration);
    voice.player.stop(time + holdDuration + releaseDuration + 0.05);

    if (!isOffline) {
      setTimeout(() => {
        voice.player.dispose();
        voice.gain.dispose();
        disposeOutputChain(chain);
      }, Math.ceil(getPerformanceNoteRenderDuration(params) * 1000));
    }
    return;
  }

  const synth = createPerformancePolySynth(engine, params, chain.filter);
  synth.triggerAttack(note, time, velocity);
  synth.triggerRelease(note, time + holdDuration);

  if (!isOffline) {
    const lifetimeMs = Math.ceil(getPerformanceNoteRenderDuration(params) * 1000);
    setTimeout(() => {
      synth.dispose();
      disposeOutputChain(chain);
    }, lifetimeMs);
  }
};

export const buildRecipeGraph = async (recipe: RecipeType, params: AudioParams, time: number, isOffline: boolean) => {
  const engine = getResolvedEngine(recipe, params.engine);

  if (engine === 'grain') {
    await buildGrainRecipeGraph(recipe, params, time, isOffline);
    return;
  }

  const pitchFrequency = getPitchFrequency(params.pitch);
  const triggerDuration = getTriggerDuration(params.decay);
  const chain = createOutputChain(params);
  const synth = (await createOneShotSynth(engine, params)).connect(chain.filter);

  if (!isOffline) {
    activeSynth = synth;
    activeFilter = chain.filter;
    currentRecipe = recipe;
    activeEngine = engine;
  }

  if ((engine === 'poly' || engine === 'fat' || engine === 'polyfm') && synth instanceof Tone.PolySynth) {
    synth.maxPolyphony = getPerformanceMaxPolyphony(engine, params);
  }

  triggerRecipePattern(synth, recipe, pitchFrequency, triggerDuration, time);

  if (!isOffline) {
    const lifetimeMs = Math.ceil(getRenderDuration(recipe, params) * 1000);
    setTimeout(() => {
      if (activeSynth === synth) activeSynth = null;
      if (activeFilter === chain.filter) activeFilter = null;
      if (currentRecipe === recipe) currentRecipe = null;
      if (activeEngine === engine) activeEngine = null;
      synth.dispose();
      disposeOutputChain(chain);
    }, lifetimeMs);
  }
};

export const playSound = async (recipe: RecipeType, params: AudioParams) => {
  await Tone.start();
  await buildRecipeGraph(recipe, params, Tone.now(), false);
};
