import type {
  AudioParams,
  BasicParamKey,
  FilterType,
  ResolvedSynthEngine,
  SynthEngine,
  SynthOscillatorType
} from './types';
import { sortSampleNotes } from './sampleUtils';

export const STOCK_PIANO_SAMPLE_BASE_URL = 'https://tonejs.github.io/audio/salamander/';
export const STOCK_PIANO_SAMPLE_URLS: Record<string, string> = {
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3'
};

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
  release: 0.22,
  sampleSource: 'stock',
  sampleRootNote: 'C4',
  uploadedSampleUrls: {},
  uploadedSampleLabel: ''
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
  mono: 'MonoSynth',
  fm: 'FMSynth',
  am: 'AMSynth',
  poly: 'PolySynth',
  fat: 'FatOscillator',
  membrane: 'MembraneSynth',
  metal: 'MetalSynth',
  duo: 'DuoSynth',
  polyfm: 'PolySynth (FM)',
  grain: 'Granular Synthesis',
  sampler: 'Sampler'
};

export const engineOptions: Array<{ value: SynthEngine; label: string }> = [
  { value: 'synth', label: 'Synth' },
  { value: 'mono', label: 'MonoSynth' },
  { value: 'fm', label: 'FMSynth' },
  { value: 'am', label: 'AMSynth' },
  { value: 'poly', label: 'PolySynth' },
  { value: 'fat', label: 'FatOscillator' },
  { value: 'metal', label: 'MetalSynth' },
  { value: 'grain', label: 'Granular Synthesis' },
  { value: 'sampler', label: 'Sampler' },
  { value: 'membrane', label: 'MembraneSynth' },
  { value: 'duo', label: 'DuoSynth' },
  { value: 'polyfm', label: 'PolySynth (FM)' }
];

export const oscillatorOptions: Array<{ value: SynthOscillatorType; label: string }> = [
  { value: 'sine', label: 'Sine' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'square', label: 'Square' },
  { value: 'sawtooth', label: 'Sawtooth' },
  { value: 'fatsine', label: 'Fat Sine' },
  { value: 'fatsquare', label: 'Fat Square' },
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
export const toMonoFilterEnvelopeRange = (value: number) => 1 + value * 6;
export const toPortamentoSeconds = (value: number) => value * 0.18;
export const toPolyDetuneCents = (value: number) => value * 30;
export const toPolyVoiceCount = (value: number) => 2 + Math.round(value * 6);
export const toFatSpreadCents = (value: number) => 8 + value * 72;
export const toFatVoiceCount = (value: number) => 2 + Math.round(value * 4);
export const toGrainSizeSeconds = (value: number) => 0.03 + value * 0.35;
export const toGrainOverlapSeconds = (value: number) => 0.01 + value * 0.22;

export const formatSeconds = (value: number) => `${value.toFixed(value >= 1 ? 1 : 2)}s`;
export const formatFrequency = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} kHz`;
  return `${Math.round(value)} Hz`;
};

export const getActiveSampleUrls = (params: AudioParams) =>
  params.sampleSource === 'upload' && Object.keys(params.uploadedSampleUrls).length > 0
    ? params.uploadedSampleUrls
    : STOCK_PIANO_SAMPLE_URLS;

export const getActiveSampleBaseUrl = (params: AudioParams) =>
  params.sampleSource === 'upload' && Object.keys(params.uploadedSampleUrls).length > 0
    ? ''
    : STOCK_PIANO_SAMPLE_BASE_URL;

export const getAvailableSampleNotes = (params: AudioParams) => sortSampleNotes(Object.keys(getActiveSampleUrls(params)));

export const getResolvedSampleRootNote = (params: AudioParams) => {
  const notes = getAvailableSampleNotes(params);
  if (notes.length === 0) return defaultAudioParams.sampleRootNote;
  return notes.includes(params.sampleRootNote) ? params.sampleRootNote : notes[0];
};

export const getSelectedSampleUrl = (params: AudioParams) => {
  const urls = getActiveSampleUrls(params);
  const rootNote = getResolvedSampleRootNote(params);
  return urls[rootNote] ?? Object.values(urls)[0] ?? '';
};

export const getSampleSelectionSignature = (params: AudioParams) => {
  const source = params.sampleSource === 'upload' && Object.keys(params.uploadedSampleUrls).length > 0 ? 'upload' : 'stock';
  const entries = Object.entries(getActiveSampleUrls(params))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([note, url]) => `${note}:${url}`)
    .join('|');
  return `${source}:${getResolvedSampleRootNote(params)}:${entries}`;
};

export const syncBrightnessToCutoff = (params: AudioParams): AudioParams => ({
  ...params,
  filterCutoff: params.brightness
});
