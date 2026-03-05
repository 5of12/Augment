export type RecipeType = 'tap' | 'click' | 'bloop' | 'chirp' | 'success' | 'error';

export interface AudioParams {
  pitch: number;
  decay: number;
  brightness: number;
  character: number;
}

export interface Variant {
  name: string;
  recipe: RecipeType;
  params: AudioParams;
}
