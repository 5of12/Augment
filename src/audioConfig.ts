import { AudioParams, BasicParamKey, FilterType, ResolvedSynthEngine, SynthEngine, SynthOscillatorType } from './types';

export const defaultAudioParams: AudioParams = {
  pitch: 0.5,
  decay: 0.3,
  brightness: 0.7,
  character: 0.2,
  filterCutoff: 0.7,
  engine: 'auto',
  oscillatorType: 'sine',
  modulationType: 'triangle',
  filterType: 'lowpass',
  filterQ: 0.18,
  attack: 0.03,
  envelopeDecay: 0.28,
  sustain: 0.16,
  release: 0.22
};

export const basicParameterKeys: BasicParamKey[] = ['pitch', 'decay', 'brightness', 'character'];

export const basicParameterLabels: Record<BasicParamKey, string> = {
  pitch: 'Pitch',
  decay: 'Length',
  brightness: 'Brightness',
  character: 'Character'
};

export const engineLabels: Record<ResolvedSynthEngine, string> = {
  synth: 'Synth',
  fm: 'FMSynth',
  am: 'AMSynth',
  membrane: 'MembraneSynth',
  metal: 'MetalSynth',
  duo: 'DuoSynth',
  polyfm: 'PolySynth (FM)'
};

export const engineOptions: Array<{ value: SynthEngine; label: string }> = [
  { value: 'auto', label: 'Auto (Recipe)' },
  { value: 'synth', label: 'Synth' },
  { value: 'fm', label: 'FMSynth' },
  { value: 'am', label: 'AMSynth' },
  { value: 'membrane', label: 'MembraneSynth' },
  { value: 'metal', label: 'MetalSynth' },
  { value: 'duo', label: 'DuoSynth' },
  { value: 'polyfm', label: 'PolySynth (FM)' }
];

export const oscillatorOptions: Array<{ value: SynthOscillatorType; label: string }> = [
  { value: 'sine', label: 'Sine' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'square', label: 'Square' },
  { value: 'sawtooth', label: 'Sawtooth' },
  { value: 'fatsine', label: 'Fat Sine' },
  { value: 'fattriangle', label: 'Fat Triangle' },
  { value: 'fatsawtooth', label: 'Fat Saw' },
  { value: 'pulse', label: 'Pulse' }
];

export const filterOptions: Array<{ value: FilterType; label: string }> = [
  { value: 'lowpass', label: 'Low-pass' },
  { value: 'bandpass', label: 'Band-pass' },
  { value: 'highpass', label: 'High-pass' },
  { value: 'notch', label: 'Notch' }
];

export const toAttackSeconds = (value: number) => 0.001 + value * 0.45;
export const toEnvelopeDecaySeconds = (value: number) => 0.02 + value * 1.1;
export const toReleaseSeconds = (value: number) => 0.03 + value * 1.6;
export const toFilterQ = (value: number) => 0.2 + value * 18;
export const toFilterCutoffFrequency = (value: number) => 80 + value * 15920;
export const toPitchFrequency = (value: number) => value * 2000 + 100;
export const toTriggerLengthSeconds = (value: number) => 0.05 + value * 0.95;

export const formatSeconds = (value: number) => `${value.toFixed(value >= 1 ? 1 : 2)}s`;
export const formatFrequency = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} kHz`;
  return `${Math.round(value)} Hz`;
};

export const syncBrightnessToCutoff = (params: AudioParams): AudioParams => ({
  ...params,
  filterCutoff: params.brightness
});
