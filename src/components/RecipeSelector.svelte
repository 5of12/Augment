<script lang="ts">
  import type { RecipeType } from '../types';

  let { currentRecipe, onSelect } = $props<{
    currentRecipe: RecipeType;
    onSelect: (recipe: RecipeType) => void;
  }>();

  const recipes: RecipeType[] = ['tap', 'click', 'bloop', 'chirp', 'success', 'error'];
</script>

<div class="flex flex-col gap-2">
  <h2 class="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-2">Sound Type</h2>
  {#each recipes as r}
    <button
      onclick={() => onSelect(r)}
      class={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentRecipe === r ? 'bg-[#111] text-white' : 'text-[#555] hover:bg-[#eaeaea]'}`}
    >
      {r.charAt(0).toUpperCase() + r.slice(1)}
    </button>
  {/each}
</div>
