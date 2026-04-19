<script lang="ts">
  import type { AudioParams, ResolvedSynthEngine } from '../../types';
  import { engineOptions, formatFrequency, toPitchFrequency, formatSeconds, toTriggerLengthSeconds } from '../../audioConfig';
  import Knob from '../Knob.svelte';

  let { params, onChange, resolvedEngine, selectedEngine, recipeLabel } = $props<{
    params: AudioParams;
    onChange: <K extends keyof AudioParams>(key: K, value: AudioParams[K]) => void;
    resolvedEngine: ResolvedSynthEngine;
    selectedEngine: AudioParams['engine'];
    recipeLabel: string;
  }>();
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

  <label id="engine-select-field" class="advanced-select-field flex flex-col gap-2 rounded-xl border border-[#d7d6d0] bg-white p-3">
    <span class="text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">Algorithm</span>
    <select
      id="engine-select-input"
      aria-label="Synthesis algorithm"
      value={selectedEngine}
      onchange={(e) => onChange('engine', (e.target as HTMLSelectElement).value as any)}
      class="advanced-select-input rounded-lg border border-[#d7d6d0] bg-[#faf9f5] px-3 py-2 text-[13px] font-medium text-[#111] outline-none transition-colors focus:border-[#ff4a00]"
    >
      {#each engineOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </label>

  <div class="advanced-tuning-section rounded-xl border border-[#d7d6d0] bg-white p-3">
    <div class="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">Tuning</div>
    <div class="flex justify-center">
      <Knob
        id="pitch-tuning-knob"
        ariaLabel="Pitch tuning"
        label="Pitch"
        value={params.pitch}
        displayValue={formatFrequency(toPitchFrequency(params.pitch))}
        defaultValue={0.5}
        onChange={(value) => onChange('pitch', value)}
      />
    </div>
  </div>

  <div class="advanced-duration-section rounded-xl border border-[#d7d6d0] bg-white p-3">
    <div class="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">Master Envelope</div>
    <div class="flex justify-center">
      <Knob
        id="decay-master-knob"
        ariaLabel="Master duration"
        label="Duration"
        value={params.decay}
        displayValue={formatSeconds(toTriggerLengthSeconds(params.decay))}
        defaultValue={0.3}
        onChange={(value) => onChange('decay', value)}
      />
    </div>
  </div>
</aside>
