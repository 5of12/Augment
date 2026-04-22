<script lang="ts">
  import type { RecipeType } from '../types';

  let { currentRecipe, onSelect } = $props<{
    currentRecipe: RecipeType;
    onSelect: (recipe: RecipeType) => void;
  }>();

  const recipes: RecipeType[] = ['tap', 'click', 'bloop', 'chirp', 'success', 'error'];
</script>

<div id="recipe-selector" class="recipe-selector flex flex-col gap-3">
  <h2 id="recipe-selector-title" class="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#aaa]">Sound Type</h2>

  <label
    id="recipe-select-field"
    class="recipe-select-field flex flex-col gap-2 rounded-xl border border-[#d7d6d0] bg-white p-3 md:hidden"
  >
    <span class="text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">Preset</span>
    <select
      id="recipe-select-input"
      aria-label="Sound type"
      value={currentRecipe}
      onchange={(event) => onSelect((event.target as HTMLSelectElement).value as RecipeType)}
      class="recipe-select-input rounded-lg border border-[#d7d6d0] bg-[#faf9f5] px-3 py-2 text-[13px] font-medium text-[#111] outline-none transition-colors focus:border-[#ff4a00]"
    >
      {#each recipes as recipe}
        <option value={recipe}>{recipe.charAt(0).toUpperCase() + recipe.slice(1)}</option>
      {/each}
    </select>
  </label>

  <div
    id="recipe-list-view"
    class="recipe-list-view hidden max-h-full min-h-0 flex-col gap-1 overflow-y-auto md:flex"
    role="list"
    aria-label="Sound types"
  >
    {#each recipes as recipe}
      <button
        id={`recipe-option-${recipe}`}
        onclick={() => onSelect(recipe)}
        class={`recipe-list-item rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
          currentRecipe === recipe ? 'bg-[#111] text-white' : 'text-[#555] hover:bg-[#eaeaea]'
        }`}
      >
        {recipe.charAt(0).toUpperCase() + recipe.slice(1)}
      </button>
    {/each}
  </div>
</div>
