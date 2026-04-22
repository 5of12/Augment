<script lang="ts">
  import { tick } from 'svelte';
  import type { AudioParams, SynthEngine } from '../../types';
  import { engineOptions } from '../../audioConfig';

  let { onChange, selectedEngine, recipeLabel } = $props<{
    onChange: <K extends keyof AudioParams>(key: K, value: AudioParams[K]) => void;
    selectedEngine: SynthEngine;
    recipeLabel: string;
  }>();

  let engineButtonElements: Array<HTMLButtonElement | null> = [];
  const hiddenAdvancedEngineValues = new Set<SynthEngine>(['synth', 'poly', 'polyfm']);
  const visibleEngineOptions = engineOptions
    .filter((option) => !hiddenAdvancedEngineValues.has(option.value))
    .sort((left, right) => left.label.localeCompare(right.label));
  const hiddenSelectedOption = $derived(
    visibleEngineOptions.some((option) => option.value === selectedEngine)
      ? null
      : engineOptions.find((option) => option.value === selectedEngine) ?? null
  );
  const mobileSelectedEngine = $derived(hiddenSelectedOption ? '' : selectedEngine);

  const focusSelectedEngine = async (engine: SynthEngine) => {
    await tick();
    const selectedIndex = visibleEngineOptions.findIndex((option) => option.value === engine);
    if (selectedIndex >= 0) {
      engineButtonElements[selectedIndex]?.focus();
    }
  };

  const handleEngineListKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof HTMLSelectElement) return;

    const currentIndex = visibleEngineOptions.findIndex((option) => option.value === selectedEngine);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % visibleEngineOptions.length;
    } else if (event.key === 'ArrowUp') {
      nextIndex = currentIndex < 0 ? visibleEngineOptions.length - 1 : (currentIndex - 1 + visibleEngineOptions.length) % visibleEngineOptions.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = visibleEngineOptions.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextEngine = visibleEngineOptions[nextIndex];
    onChange('engine', nextEngine.value);
    void focusSelectedEngine(nextEngine.value);
  };
</script>

<aside
  id="advanced-engine-sidebar"
  class="advanced-engine-sidebar flex flex-col gap-3 overflow-y-auto bg-[#f8f6f0] p-4 md:w-[15rem] md:border-r md:border-[#dfdfdd] md:p-5 lg:w-[17rem]"
>
  <div class="advanced-engine-header mb-2 flex flex-col gap-1.5">
    <h2 id="advanced-engine-title" class="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">
      Synthesis Engine
    </h2>
    <div class="advanced-recipe-badge flex w-fit items-center gap-1.5 rounded-full border border-[#d7d4cb] bg-[#f5f3ed] px-2.5 py-1">
      <div class="h-1.5 w-1.5 rounded-full bg-[#ff4a00]"></div>
      <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6c6861]">{recipeLabel} Base</span>
    </div>
  </div>

  <label
    id="engine-select-field"
    class="advanced-select-field flex flex-col gap-2 rounded-xl border border-[#d7d6d0] bg-white p-3 md:hidden"
  >
    <span class="text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">Algorithm</span>
    <select
      id="engine-select-input"
      aria-label="Synthesis algorithm"
      value={mobileSelectedEngine}
      onchange={(e) => onChange('engine', (e.target as HTMLSelectElement).value as SynthEngine)}
      class="advanced-select-input rounded-lg border border-[#d7d6d0] bg-[#faf9f5] px-3 py-2 text-[13px] font-medium text-[#111] outline-none transition-colors focus:border-[#ff4a00]"
    >
      {#if hiddenSelectedOption}
        <option value="" disabled>{hiddenSelectedOption.label} (Recipe Only)</option>
      {/if}
      {#each visibleEngineOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </label>

  <div
    id="engine-list-view"
    class="engine-list-view hidden min-h-0 flex-1 flex-col gap-1 overflow-y-auto md:flex"
    role="listbox"
    aria-label="Synthesis engines"
    tabindex="0"
    aria-activedescendant={hiddenSelectedOption ? undefined : `engine-option-${selectedEngine}`}
    onkeydown={handleEngineListKeyDown}
    onfocus={(event) => {
      if (event.target === event.currentTarget) {
        void focusSelectedEngine(selectedEngine);
      }
    }}
  >
    {#each visibleEngineOptions as option, index}
      <button
        id={`engine-option-${option.value}`}
        bind:this={engineButtonElements[index]}
        onclick={() => onChange('engine', option.value)}
        role="option"
        aria-selected={selectedEngine === option.value}
        class={`engine-list-item rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
          selectedEngine === option.value ? 'bg-[#111] text-white' : 'text-[#555] hover:bg-[#eaeaea]'
        }`}
      >
        {option.label}
      </button>
    {/each}
  </div>
</aside>
