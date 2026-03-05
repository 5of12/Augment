import * as Tone from 'tone';
import { buildRecipeGraph } from './audioEngine';
import { RecipeType, AudioParams } from '../types';

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

export const exportWav = async (recipe: RecipeType, params: AudioParams) => {
  const buffer = await Tone.Offline(() => {
    buildRecipeGraph(recipe, params, 0, true);
  }, 1.0);
  
  const wavBlob = audioBufferToWav(buffer.get());
  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `augment-${recipe}.wav`;
  a.click();
  URL.revokeObjectURL(url);
};
