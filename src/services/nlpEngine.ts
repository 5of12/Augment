import type { RecipeType, AudioParams, Variant } from '../types';
import { defaultAudioParams, syncBrightnessToCutoff } from '../audioConfig';

export const generateVariantsFromPrompt = (prompt: string, currentRecipe: RecipeType, currentParams: AudioParams): Variant[] => {
  const text = prompt.toLowerCase();
  let base = { ...defaultAudioParams, ...currentParams };
  let newRecipe = currentRecipe;

  if (text.includes('click') || text.includes('tap')) newRecipe = 'click';
  if (text.includes('bloop') || text.includes('bubble')) newRecipe = 'bloop';
  if (text.includes('success') || text.includes('win')) newRecipe = 'success';
  if (text.includes('error') || text.includes('fail')) newRecipe = 'error';

  if (text.includes('cute') || text.includes('soft')) { 
    base.pitch = 0.8; 
    base.brightness = 0.3; 
    base.decay = 0.4; 
  }
  if (text.includes('sharp') || text.includes('hard') || text.includes('snappy')) { 
    base.brightness = 0.9; 
    base.decay = 0.1; 
  }
  if (text.includes('deep') || text.includes('low')) { 
    base.pitch = 0.2; 
  }
  if (text.includes('noisy') || text.includes('retro')) { 
    base.character = 0.9; 
    base.brightness = 0.4; 
  }

  base = syncBrightnessToCutoff(base);

  return [
    { name: "Base Match", recipe: newRecipe, params: { ...base } },
    {
      name: "Brighter",
      recipe: newRecipe,
      params: syncBrightnessToCutoff({ ...base, brightness: Math.min(1, base.brightness + 0.3) })
    },
    { name: "Snappier", recipe: newRecipe, params: { ...base, decay: Math.max(0, base.decay - 0.2) } },
    { name: "Higher Tone", recipe: newRecipe, params: { ...base, pitch: Math.min(1, base.pitch + 0.3) } }
  ];
};
