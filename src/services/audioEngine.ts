import * as Tone from 'tone';
import type { AudioParams, RecipeType, ResolvedSynthEngine, SynthEngine } from '../types';
import {
  engineLabels,
  toAttackSeconds,
  toEnvelopeDecaySeconds,
  toFilterCutoffFrequency,
  toFilterQ,
  toReleaseSeconds
} from '../audioConfig';

export const globalAnalyser = new Tone.Analyser("waveform", 1024);
Tone.getDestination().connect(globalAnalyser);

type ManagedSynth =
  | Tone.Synth
  | Tone.PolySynth<Tone.FMSynth>
  | Tone.MembraneSynth
  | Tone.MetalSynth
  | Tone.FMSynth
  | Tone.AMSynth
  | Tone.DuoSynth;

type PerformanceSynth = Tone.PolySynth<any>;
type VoiceConstructor =
  | typeof Tone.Synth
  | typeof Tone.FMSynth
  | typeof Tone.AMSynth
  | typeof Tone.MembraneSynth
  | typeof Tone.MetalSynth
  | typeof Tone.DuoSynth;

interface PerformanceState {
  synth: PerformanceSynth;
  filter: Tone.Filter;
  cleanupHighpass: Tone.Filter;
  limiter: Tone.Limiter;
  engine: ResolvedSynthEngine;
  recipe: RecipeType;
}

const recipeEngineMap: Record<RecipeType, ResolvedSynthEngine> = {
  tap: 'membrane',
  click: 'metal',
  bloop: 'fm',
  chirp: 'am',
  success: 'polyfm',
  error: 'duo'
};

const performanceVoiceMap: Record<ResolvedSynthEngine, VoiceConstructor> = {
  synth: Tone.Synth,
  fm: Tone.FMSynth,
  am: Tone.AMSynth,
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
    sustain: Math.min(envelope.sustain, 0.4),
    release: Math.max(0.02, envelope.release * 0.85)
  };
};
const getHarmonicity = (character: number) => 0.5 + character * 4.5;
const getModulationIndex = (brightness: number) => 1 + brightness * 14;
const getMembranePitchDecay = (brightness: number) => 0.01 + brightness * 0.2;
const getMembraneOctaves = (character: number) => 1 + character * 8;
const getMetalResonance = (params: AudioParams) => 800 + params.filterQ * 5500;
const getDuoHarmonicity = (brightness: number) => 0.75 + brightness * 0.9;
const getVibratoRate = (brightness: number) => 3 + brightness * 6;
const toToneNote = (midi: number) => Tone.Frequency(midi, 'midi').toNote();

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

const applyFrequencySweep = (
  synth: ManagedSynth,
  engine: ResolvedSynthEngine,
  startFrequency: number,
  endFrequency: number,
  time: number,
  endTime: number
) => {
  if (engine === 'polyfm' || synth instanceof Tone.PolySynth) return;
  synth.frequency.setValueAtTime(startFrequency, time);
  synth.frequency.exponentialRampToValueAtTime(endFrequency, endTime);
};

const triggerNote = (synth: ManagedSynth, note: number, duration: number, time: number) => {
  synth.triggerAttackRelease(note, duration, time);
};

const triggerRecipePattern = (
  synth: ManagedSynth,
  engine: ResolvedSynthEngine,
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
      applyFrequencySweep(synth, engine, pitchFrequency * 1.5, pitchFrequency * 0.25, time, time + triggerDuration);
      triggerNote(synth, pitchFrequency, triggerDuration, time);
      break;
    case 'chirp':
      applyFrequencySweep(synth, engine, pitchFrequency * 0.55, pitchFrequency * 2, time, time + triggerDuration * 0.5);
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
  const harmonicity = getHarmonicity(params.character);
  const modulationIndex = getModulationIndex(params.brightness);

  switch (engine) {
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
        harmonicity,
        modulationIndex,
        resonance: getMetalResonance(params),
        octaves: 1.2 + params.character * 2
      };
    case 'fm':
      return {
        harmonicity,
        modulationIndex,
        oscillator: { type: params.oscillatorType },
        modulation: { type: params.modulationType },
        envelope,
        modulationEnvelope
      };
    case 'am':
      return {
        harmonicity,
        oscillator: { type: params.oscillatorType },
        modulation: { type: params.modulationType },
        envelope,
        modulationEnvelope
      };
    case 'polyfm':
      return {
        harmonicity: Math.max(0.75, harmonicity),
        modulationIndex: Math.max(1, modulationIndex * 0.6),
        oscillator: { type: params.oscillatorType },
        modulation: { type: params.modulationType },
        envelope,
        modulationEnvelope
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
    case 'synth':
    default:
      return {
        oscillator: { type: params.oscillatorType },
        envelope
      };
  }
};

const createOneShotSynth = (engine: ResolvedSynthEngine, params: AudioParams): ManagedSynth => {
  const options = getEngineOptions(engine, params);

  switch (engine) {
    case 'membrane':
      return new Tone.MembraneSynth(options as ConstructorParameters<typeof Tone.MembraneSynth>[0]);
    case 'metal':
      return new Tone.MetalSynth(options as ConstructorParameters<typeof Tone.MetalSynth>[0]);
    case 'fm':
      return new Tone.FMSynth(options as ConstructorParameters<typeof Tone.FMSynth>[0]);
    case 'am':
      return new Tone.AMSynth(options as ConstructorParameters<typeof Tone.AMSynth>[0]);
    case 'duo':
      return new Tone.DuoSynth(options as ConstructorParameters<typeof Tone.DuoSynth>[0]);
    case 'polyfm':
      return new Tone.PolySynth(Tone.FMSynth, options as ConstructorParameters<typeof Tone.FMSynth>[0]);
    case 'synth':
    default:
      return new Tone.Synth(options as ConstructorParameters<typeof Tone.Synth>[0]);
  }
};

const disposePerformanceState = () => {
  if (!performanceState) return;
  performanceState.synth.releaseAll();
  performanceState.synth.dispose();
  performanceState.filter.dispose();
  performanceState.cleanupHighpass.dispose();
  performanceState.limiter.dispose();
  performanceState = null;
};

const rebuildPerformanceState = (recipe: RecipeType, params: AudioParams) => {
  const engine = getResolvedEngine(recipe, params.engine);
  disposePerformanceState();

  const filter = new Tone.Filter(getFilterFrequency(params.filterCutoff), params.filterType);
  filter.Q.value = toFilterQ(params.filterQ);

  const cleanupHighpass = new Tone.Filter(30, "highpass");
  const limiter = new Tone.Limiter(-3);
  filter.connect(cleanupHighpass);
  cleanupHighpass.connect(limiter);
  limiter.connect(Tone.getDestination());

  const VoiceConstructor = performanceVoiceMap[engine];
  const synth = new Tone.PolySynth(VoiceConstructor as any, getEngineOptions(engine, params) as any).connect(filter) as PerformanceSynth;
  synth.maxPolyphony = engine === 'polyfm' ? 10 : 12;

  performanceState = {
    synth,
    filter,
    cleanupHighpass,
    limiter,
    engine,
    recipe
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

export const updateActiveParams = (params: AudioParams) => {
  if (!activeFilter || !activeSynth || !currentRecipe || !activeEngine) return;
  if (activeEngine !== getResolvedEngine(currentRecipe, params.engine)) return;

  applyFilterSettings(activeFilter, params);

  const pitchFrequency = getPitchFrequency(params.pitch);
  const primaryFrequency = getPrimaryRecipeFrequency(currentRecipe, pitchFrequency);
  const oneShotOptions = getEngineOptions(activeEngine, params);

  try {
    switch (activeEngine) {
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
      case 'polyfm':
        if (activeSynth instanceof Tone.PolySynth) {
          activeSynth.set(oneShotOptions as Parameters<Tone.PolySynth<any>['set']>[0]);
        }
        break;
      case 'duo':
        if (activeSynth instanceof Tone.DuoSynth) {
          if (currentRecipe !== 'error') activeSynth.frequency.rampTo(primaryFrequency, 0.05);
          activeSynth.set(oneShotOptions as Parameters<Tone.DuoSynth['set']>[0]);
        }
        break;
      case 'synth':
        if (activeSynth instanceof Tone.Synth) {
          if (currentRecipe !== 'bloop' && currentRecipe !== 'chirp') activeSynth.frequency.rampTo(primaryFrequency, 0.05);
          activeSynth.set(oneShotOptions as Parameters<Tone.Synth['set']>[0]);
        }
        break;
    }
  } catch {
    // Ignore errors if the one-shot synth is disposed during update.
  }
};

export const updatePerformanceInstrument = (recipe: RecipeType, params: AudioParams) => {
  const engine = getResolvedEngine(recipe, params.engine);

  if (!performanceState || performanceState.engine !== engine) {
    rebuildPerformanceState(recipe, params);
    return;
  }

  performanceState.recipe = recipe;
  applyFilterSettings(performanceState.filter, params);
  performanceState.synth.set(getEngineOptions(engine, params) as Parameters<Tone.PolySynth<any>['set']>[0]);
};

export const teardownPerformanceInstrument = () => {
  disposePerformanceState();
};

export const triggerPerformanceNote = async (recipe: RecipeType, params: AudioParams, midi: number, velocity = 0.9) => {
  await Tone.start();
  updatePerformanceInstrument(recipe, params);
  performanceState?.synth.triggerAttack(toToneNote(midi), Tone.now(), velocity);
};

export const releasePerformanceNote = (midi: number) => {
  performanceState?.synth.triggerRelease(toToneNote(midi), Tone.now());
};

export const releaseAllPerformanceNotes = () => {
  performanceState?.synth.releaseAll(Tone.now());
};

export const buildRecipeGraph = (recipe: RecipeType, params: AudioParams, time: number, isOffline: boolean) => {
  const engine = getResolvedEngine(recipe, params.engine);
  const pitchFrequency = getPitchFrequency(params.pitch);
  const triggerDuration = getTriggerDuration(params.decay);

  const toneFilter = new Tone.Filter(getFilterFrequency(params.filterCutoff), params.filterType);
  toneFilter.Q.value = toFilterQ(params.filterQ);

  const cleanupHighpass = new Tone.Filter(30, "highpass");
  const limiter = new Tone.Limiter(-3);

  toneFilter.connect(cleanupHighpass);
  cleanupHighpass.connect(limiter);
  limiter.connect(Tone.getDestination());

  const synth = createOneShotSynth(engine, params).connect(toneFilter);

  if (!isOffline) {
    activeSynth = synth;
    activeFilter = toneFilter;
    currentRecipe = recipe;
    activeEngine = engine;
  }

  triggerRecipePattern(synth, engine, recipe, pitchFrequency, triggerDuration, time);

  if (!isOffline) {
    const lifetimeMs = Math.ceil(getRenderDuration(recipe, params) * 1000);
    setTimeout(() => {
      if (activeSynth === synth) activeSynth = null;
      if (activeFilter === toneFilter) activeFilter = null;
      if (currentRecipe === recipe) currentRecipe = null;
      if (activeEngine === engine) activeEngine = null;
      synth.dispose();
      toneFilter.dispose();
      cleanupHighpass.dispose();
      limiter.dispose();
    }, lifetimeMs);
  }
};

export const playSound = async (recipe: RecipeType, params: AudioParams) => {
  await Tone.start();
  buildRecipeGraph(recipe, params, Tone.now(), false);
};
