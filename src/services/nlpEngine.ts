import { RecipeType, AudioParams, Variant } from '../types';

const defaultParams: AudioParams = { pitch: 0.5, decay: 0.3, brightness: 0.7, character: 0.2 };

export const generateVariantsFromPrompt = (prompt: string, currentRecipe: RecipeType): Variant[] => {
  const text = prompt.toLowerCase();
  let base = { ...defaultParams };
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

  return [
    { name: "Base Match", recipe: newRecipe, params: { ...base } },
    { name: "Brighter", recipe: newRecipe, params: { ...base, brightness: Math.min(1, base.brightness + 0.3) } },
    { name: "Snappier", recipe: newRecipe, params: { ...base, decay: Math.max(0, base.decay - 0.2) } },
    { name: "Higher Tone", recipe: newRecipe, params: { ...base, pitch: Math.min(1, base.pitch + 0.3) } }
  ];
};
