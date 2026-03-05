import React from 'react';
import { RecipeType } from '../types';

interface RecipeSelectorProps {
  currentRecipe: RecipeType;
  onSelect: (recipe: RecipeType) => void;
}

const recipes: RecipeType[] = ['tap', 'click', 'bloop', 'chirp', 'success', 'error'];

export const RecipeSelector: React.FC<RecipeSelectorProps> = ({ currentRecipe, onSelect }) => {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-2">Sound Type</h2>
      {recipes.map(r => (
        <button 
          key={r} 
          onClick={() => onSelect(r)}
          className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentRecipe === r ? 'bg-[#111] text-white' : 'text-[#555] hover:bg-[#eaeaea]'}`}
        >
          {r.charAt(0).toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>
  );
};
