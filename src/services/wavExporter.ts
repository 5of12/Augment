import * as Tone from 'tone';
import { buildPerformanceNoteGraph, buildRecipeGraph, getPerformanceNoteRenderDuration, getRenderDuration } from './audioEngine';
import type { AudioExportRequest } from '../types';

export const audioBufferToWav = (buffer: AudioBuffer) => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const result = new Int16Array(buffer.length * numChannels);
  
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) {
      let sample = Math.max(-1, Math.min(1, channelData[i]));
      result[i * numChannels + channel] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
  }

  const dataLength = result.length * 2;
  const bufferArray = new ArrayBuffer(44 + dataLength);
  const view = new DataView(bufferArray);
  const writeString = (offset: number, string: string) => { 
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i)); 
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  for (let i = 0; i < result.length; i++) view.setInt16(44 + i * 2, result[i], true);
  return new Blob([view], { type: 'audio/wav' });
};

const getExportDuration = (request: AudioExportRequest) =>
  request.kind === 'performance-note'
    ? getPerformanceNoteRenderDuration(request.params)
    : getRenderDuration(request.recipe, request.params);

const formatNoteForFilename = (midi: number) =>
  Tone.Frequency(midi, 'midi')
    .toNote()
    .replace('#', 's')
    .toLowerCase();

const getExportFilename = (request: AudioExportRequest) =>
  request.kind === 'performance-note'
    ? `augment-${request.recipe}-${formatNoteForFilename(request.midi)}.wav`
    : `augment-${request.recipe}.wav`;

export const exportWav = async (request: AudioExportRequest) => {
  const buffer = await Tone.Offline(async () => {
    if (request.kind === 'performance-note') {
      await buildPerformanceNoteGraph(request.recipe, request.params, request.midi, request.velocity, 0, true);
      return;
    }

    await buildRecipeGraph(request.recipe, request.params, 0, true);
  }, getExportDuration(request));
  
  const audioBuffer = buffer.get();
  if (!audioBuffer) return;

  const wavBlob = audioBufferToWav(audioBuffer);
  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getExportFilename(request);
  a.click();
  URL.revokeObjectURL(url);
};
