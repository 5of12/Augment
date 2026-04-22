<script lang="ts">
  import { Play, Dice5, Download } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let {
    onPlay,
    onRandomize,
    onExport,
    centerContent
  } = $props<{
    onPlay: () => void;
    onRandomize: () => void;
    onExport: () => void;
    centerContent?: Snippet;
  }>();
</script>

<div
  id="transport-bar"
  class="transport-bar grid shrink-0 grid-cols-1 gap-3 border-t border-[#dfdfdd] bg-[#fcfcfc] px-4 py-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-5"
>
  <div class="flex items-center gap-3 md:justify-self-start">
    <button
      onclick={onPlay}
      aria-label="Play sound"
      class="flex h-12 w-12 items-center justify-center rounded-full bg-[#ff4a00] text-white shadow-md transition-transform hover:bg-[#e64200] active:scale-95"
    >
      <Play fill="currentColor" size={20} />
    </button>
    <button
      onclick={onRandomize}
      aria-label="Randomize current sound"
      class="flex h-11 items-center gap-2 rounded-full border border-[#d0d0d0] bg-[#f0f0f0] px-4 text-sm font-medium text-[#333] transition-transform hover:bg-[#e4e4e4] active:scale-95"
    >
      <Dice5 size={16} /> Random
    </button>
  </div>
  <div id="transport-center-slot" class="transport-center-slot flex items-center justify-center">
    {@render centerContent?.()}
  </div>
  <button
    onclick={onExport}
    aria-label="Export sound as WAV"
    class="flex h-11 items-center gap-2 justify-self-start rounded-full bg-[#111] px-5 text-sm font-medium text-white transition-transform hover:bg-[#333] active:scale-95 md:justify-self-end"
  >
    <Download size={16} /> Export WAV
  </button>
</div>
