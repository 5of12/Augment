export type RecipeType = 'tap' | 'click' | 'bloop' | 'chirp' | 'success' | 'error';
export type SynthEngine = 'auto' | 'synth' | 'fm' | 'am' | 'membrane' | 'metal' | 'duo' | 'polyfm';
export type ResolvedSynthEngine = Exclude<SynthEngine, 'auto'>;
export type SynthOscillatorType =
  | 'sine'
  | 'triangle'
  | 'square'
  | 'sawtooth'
  | 'fatsine'
  | 'fattriangle'
  | 'fatsawtooth'
  | 'pulse';
export type FilterType = 'lowpass' | 'bandpass' | 'highpass' | 'notch';
export type BasicParamKey = 'pitch' | 'decay' | 'brightness' | 'character';

export interface AudioParams {
  pitch: number;
  decay: number;
  brightness: number;
  character: number;
  filterCutoff: number;
  engine: SynthEngine;
  oscillatorType: SynthOscillatorType;
  modulationType: SynthOscillatorType;
  filterType: FilterType;
  filterQ: number;
  attack: number;
  envelopeDecay: number;
  sustain: number;
  release: number;
}

export interface Variant {
  name: string;
  recipe: RecipeType;
  params: AudioParams;
}
