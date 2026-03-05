import * as Tone from 'tone';
import { RecipeType, AudioParams } from '../types';

export const globalAnalyser = new Tone.Analyser("waveform", 1024);
Tone.getDestination().connect(globalAnalyser);

// Track active nodes for real-time updates
let activeSynth: Tone.Synth | Tone.NoiseSynth | Tone.PolySynth | Tone.MembraneSynth | Tone.MetalSynth | Tone.FMSynth | Tone.AMSynth | Tone.DuoSynth | null = null;
let activeFilter: Tone.Filter | null = null;
let currentRecipe: RecipeType | null = null;

export const getEngineTypeForRecipe = (recipe: RecipeType): string => {
  switch (recipe) {
    case 'tap': return 'MembraneSynth';
    case 'click': return 'MetalSynth';
    case 'bloop': return 'FMSynth';
    case 'chirp': return 'AMSynth';
    case 'success': return 'PolySynth (FM)';
    case 'error': return 'DuoSynth';
    default: return 'Synth';
  }
};

export const updateActiveParams = (params: AudioParams) => {
  if (!activeFilter || !activeSynth) return;

  const brightFreq = params.brightness * 10000 + 200;
  activeFilter.frequency.rampTo(brightFreq, 0.05);

  const pitchFreq = params.pitch * 2000 + 100;

  try {
    if (activeSynth instanceof Tone.MetalSynth) {
      activeSynth.frequency.rampTo(pitchFreq, 0.05);
      activeSynth.set({
        harmonicity: params.brightness * 5 + 0.5,
        modulationIndex: params.character * 50 + 10
      });
    } else if (activeSynth instanceof Tone.FMSynth) {
      if (currentRecipe !== 'bloop') activeSynth.frequency.rampTo(pitchFreq, 0.05);
      activeSynth.set({
        harmonicity: params.character * 3 + 0.5,
        modulationIndex: params.brightness * 10 + 1
      });
    } else if (activeSynth instanceof Tone.AMSynth) {
      if (currentRecipe !== 'chirp') activeSynth.frequency.rampTo(pitchFreq, 0.05);
      activeSynth.set({
        harmonicity: params.character * 5 + 1
      });
    } else if (activeSynth instanceof Tone.DuoSynth) {
      activeSynth.frequency.rampTo(pitchFreq * 0.5, 0.05);
      activeSynth.set({
        vibratoAmount: params.character * 0.5
      });
    } else if (activeSynth instanceof Tone.Synth) {
      if (currentRecipe !== 'bloop' && currentRecipe !== 'chirp') {
        activeSynth.frequency.rampTo(pitchFreq, 0.05);
      }
    }
  } catch (e) {
    // Ignore errors if synth is disposed during update
  }
};

export const buildRecipeGraph = (recipe: RecipeType, params: AudioParams, time: number, isOffline: boolean) => {
  const pitchFreq = params.pitch * 2000 + 100;
  const decayMs = params.decay * 0.8 + 0.05;
  const brightFreq = params.brightness * 10000 + 200;

  const filter = new Tone.Filter(brightFreq, "lowpass");
  const hp = new Tone.Filter(80, "highpass");
  const limiter = new Tone.Limiter(-3);
  
  const masterDest = filter.chain(hp, limiter, Tone.getDestination());

  if (!isOffline) {
    activeFilter = filter;
    currentRecipe = recipe;
  }

  if (recipe === 'tap') {
    const synth = new Tone.MembraneSynth({
      pitchDecay: params.brightness * 0.2 + 0.01,
      octaves: params.character * 10 + 1,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: decayMs, sustain: 0, release: 0.01 }
    }).connect(masterDest);
    if (!isOffline) activeSynth = synth;
    synth.triggerAttackRelease(pitchFreq * 0.2, decayMs, time);
    if (!isOffline) setTimeout(() => { if (activeSynth === synth) activeSynth = null; synth.dispose(); }, 1000);
  } 
  else if (recipe === 'click') {
    const synth = new Tone.MetalSynth({
      frequency: pitchFreq,
      envelope: { attack: 0.001, decay: decayMs * 0.5, release: 0.01 },
      harmonicity: params.brightness * 5 + 0.5,
      modulationIndex: params.character * 50 + 10,
      resonance: 4000,
      octaves: 1.5
    }).connect(masterDest);
    if (!isOffline) activeSynth = synth;
    synth.triggerAttackRelease(decayMs * 0.5, time);
    if (!isOffline) setTimeout(() => { if (activeSynth === synth) activeSynth = null; synth.dispose(); }, 1000);
  } 
  else if (recipe === 'bloop') {
    const synth = new Tone.FMSynth({
      harmonicity: params.character * 3 + 0.5,
      modulationIndex: params.brightness * 10 + 1,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.01, decay: decayMs, sustain: 0, release: 0.1 }
    }).connect(masterDest);
    if (!isOffline) activeSynth = synth;
    synth.frequency.setValueAtTime(pitchFreq * 1.5, time);
    synth.frequency.exponentialRampToValueAtTime(pitchFreq * 0.2, time + decayMs);
    synth.triggerAttackRelease(pitchFreq, decayMs, time);
    if (!isOffline) setTimeout(() => { if (activeSynth === synth) activeSynth = null; synth.dispose(); }, 1000);
  } 
  else if (recipe === 'chirp') {
    const synth = new Tone.AMSynth({
      harmonicity: params.character * 5 + 1,
      oscillator: { type: 'triangle' },
      modulation: { type: 'square' },
      envelope: { attack: 0.01, decay: decayMs, sustain: 0, release: 0.1 }
    }).connect(masterDest);
    if (!isOffline) activeSynth = synth;
    synth.frequency.setValueAtTime(pitchFreq * 0.5, time);
    synth.frequency.exponentialRampToValueAtTime(pitchFreq * 2, time + decayMs * 0.5);
    synth.triggerAttackRelease(pitchFreq, decayMs, time);
    if (!isOffline) setTimeout(() => { if (activeSynth === synth) activeSynth = null; synth.dispose(); }, 1000);
  } 
  else if (recipe === 'success') {
    const synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: params.brightness * 5 + 1,
      envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.1 }
    }).connect(masterDest);
    if (!isOffline) activeSynth = synth;
    synth.triggerAttackRelease(pitchFreq, 0.1, time);
    synth.triggerAttackRelease(pitchFreq * 1.5, 0.4, time + 0.15);
    if (!isOffline) setTimeout(() => { if (activeSynth === synth) activeSynth = null; synth.dispose(); }, 1000);
  } 
  else if (recipe === 'error') {
    const synth = new Tone.DuoSynth({
      vibratoAmount: params.character * 0.5,
      vibratoRate: 5,
      volume: -18,
      harmonicity: 1.05,
      voice0: { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: decayMs } },
      voice1: { oscillator: { type: 'square' }, envelope: { attack: 0.02, decay: decayMs } }
    }).connect(masterDest);
    if (!isOffline) activeSynth = synth;
    synth.triggerAttackRelease(pitchFreq * 0.5, decayMs, time);
    if (!isOffline) setTimeout(() => { if (activeSynth === synth) activeSynth = null; synth.dispose(); }, 1000);
  }
};

export const playSound = async (recipe: RecipeType, params: AudioParams) => {
  await Tone.start();
  buildRecipeGraph(recipe, params, Tone.now(), false);
};
