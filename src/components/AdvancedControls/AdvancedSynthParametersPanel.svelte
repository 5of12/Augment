<script lang="ts">
  import { Layers2 } from 'lucide-svelte';
  import type { AudioParams, FilterType, ResolvedSynthEngine, SynthOscillatorType } from '../../types';
  import {
    engineLabels,
    filterOptions,
    formatFrequency,
    oscillatorOptions,
    toFilterCutoffFrequency,
    toFilterQ
  } from '../../audioConfig';
  import Knob from '../Knob.svelte';

  let { params, onChange, resolvedEngine } = $props<{
    params: AudioParams;
    onChange: <K extends keyof AudioParams>(key: K, value: AudioParams[K]) => void;
    resolvedEngine: ResolvedSynthEngine;
  }>();

  type AdvancedKnobParamKey = 'pitch' | 'decay' | 'brightness' | 'character' | 'filterCutoff' | 'filterQ';

  interface SynthParameterDefinition {
    key: AdvancedKnobParamKey;
    label: string;
    ariaLabel: string;
    defaultValue: number;
    displayValue: (params: AudioParams) => string;
  }

  const getContextualParameterDefinitions = (engine: ResolvedSynthEngine): SynthParameterDefinition[] => {
    const commonControls: SynthParameterDefinition[] = [
      {
        key: 'filterCutoff',
        label: 'Cutoff',
        ariaLabel: 'Filter cutoff frequency',
        defaultValue: 0.7,
        displayValue: (params) => formatFrequency(toFilterCutoffFrequency(params.filterCutoff))
      },
      {
        key: 'filterQ',
        label: 'Resonance',
        ariaLabel: 'Filter resonance',
        defaultValue: 0.18,
        displayValue: (params) => `${toFilterQ(params.filterQ).toFixed(1)} Q`
      }
    ];

    switch (engine) {
      case 'fm':
      case 'polyfm':
        return [
          ...commonControls,
          {
            key: 'brightness',
            label: 'Mod Idx',
            ariaLabel: 'FM modulation index',
            defaultValue: 0.5,
            displayValue: (params) => `${(params.brightness * 10).toFixed(1)}`
          },
          {
            key: 'character',
            label: 'Harmonicity',
            ariaLabel: 'FM harmonicity ratio',
            defaultValue: 0.3,
            displayValue: (params) => `${(0.5 + params.character * 3.5).toFixed(2)}x`
          }
        ];
      case 'am':
        return [
          ...commonControls,
          {
            key: 'brightness',
            label: 'Harmonicity',
            ariaLabel: 'AM harmonicity ratio',
            defaultValue: 0.5,
            displayValue: (params) => `${(0.5 + params.brightness * 3.5).toFixed(2)}x`
          }
        ];
      case 'metal':
        return [
          ...commonControls,
          {
            key: 'brightness',
            label: 'Harmonics',
            ariaLabel: 'Metal harmonics',
            defaultValue: 0.6,
            displayValue: (params) => `${(1 + params.brightness * 20).toFixed(1)} Hz`
          },
          {
            key: 'character',
            label: 'Mod Idx',
            ariaLabel: 'Metal modulation index',
            defaultValue: 0.3,
            displayValue: (params) => `${(params.character * 100).toFixed(0)}`
          }
        ];
      case 'membrane':
        return [
          ...commonControls,
          {
            key: 'brightness',
            label: 'Octaves',
            ariaLabel: 'Membrane octaves',
            defaultValue: 0.4,
            displayValue: (params) => `${(params.brightness * 8).toFixed(1)}`
          }
        ];
      case 'duo':
        return [
          ...commonControls,
          {
            key: 'brightness',
            label: 'Spread',
            ariaLabel: 'Duo synth harmonicity',
            defaultValue: 0.7,
            displayValue: (params) => `${(0.75 + params.brightness * 0.9).toFixed(2)}x`
          },
          {
            key: 'character',
            label: 'Vibrato',
            ariaLabel: 'Duo synth vibrato amount',
            defaultValue: 0.2,
            displayValue: (params) => `${(params.character * 0.5).toFixed(2)} amt`
          }
        ];
      case 'synth':
      default:
        return commonControls;
    }
  };

  let parameterDefinitions = $derived(getContextualParameterDefinitions(resolvedEngine));
  let synthSpecificDefinitions = $derived(parameterDefinitions.filter(
    (definition) => definition.key !== 'filterCutoff' && definition.key !== 'filterQ'
  ));
  let supportsSecondaryVoice = $derived(
    resolvedEngine === 'fm' || resolvedEngine === 'am' || resolvedEngine === 'polyfm' || resolvedEngine === 'duo'
  );
  let oscillatorLabel = $derived(
    resolvedEngine === 'duo'
      ? 'Voice A'
      : resolvedEngine === 'fm' || resolvedEngine === 'am' || resolvedEngine === 'polyfm'
        ? 'Carrier'
        : 'Oscillator'
  );
  let modulatorLabel = $derived(resolvedEngine === 'duo' ? 'Voice B' : 'Modulator');
</script>

<aside
  id="advanced-parameter-panel"
  class="advanced-parameter-panel flex min-h-0 flex-col gap-3 overflow-y-auto bg-[#fafafa] p-4 md:w-[22rem] md:border-l md:border-[#dfdfdd] md:p-5 lg:w-[24rem]"
>
  <div class="advanced-parameter-header flex items-center justify-between">
    <h2 id="advanced-parameter-title" class="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">
      Parameters
    </h2>
    <div class="advanced-parameter-badge inline-flex items-center gap-1 rounded-full border border-[#d7d4cb] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6a6862]">
      <Layers2 size={11} />
      <span>{engineLabels[resolvedEngine as keyof typeof engineLabels]}</span>
    </div>
  </div>

  <section
    id="voice-control-panel"
    class="voice-control-panel rounded-[1.25rem] border border-[#dfdfdd] bg-white p-3"
  >
    <div class="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8c8a84]">Voice</div>
    <div class="space-y-3">
      <label id="oscillator-select-field" class="advanced-select-field flex flex-col gap-2 rounded-xl border border-[#d7d6d0] bg-white p-2.5">
        <span class="advanced-select-label text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">{oscillatorLabel}</span>
        <select
          id="oscillator-select"
          aria-label={oscillatorLabel}
          value={params.oscillatorType}
          onchange={(e) => onChange('oscillatorType', (e.target as HTMLSelectElement).value as SynthOscillatorType)}
          class="advanced-select-input rounded-lg border border-[#d7d6d0] bg-[#faf9f5] px-3 py-1.5 text-[13px] text-[#111] outline-none transition-colors focus:border-[#ff4a00]"
        >
          {#each oscillatorOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      {#if supportsSecondaryVoice}
        <label id="modulator-select-field" class="advanced-select-field flex flex-col gap-2 rounded-xl border border-[#d7d6d0] bg-white p-2.5">
          <span class="advanced-select-label text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">{modulatorLabel}</span>
          <select
            id="modulator-select"
            aria-label={modulatorLabel}
            value={params.modulationType}
            onchange={(e) => onChange('modulationType', (e.target as HTMLSelectElement).value as SynthOscillatorType)}
            class="advanced-select-input rounded-lg border border-[#d7d6d0] bg-[#faf9f5] px-3 py-1.5 text-[13px] text-[#111] outline-none transition-colors focus:border-[#ff4a00]"
          >
            {#each oscillatorOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>
  </section>

  <section
    id="filter-control-panel"
    class="filter-control-panel rounded-[1.25rem] border border-[#dfdfdd] bg-white p-3"
  >
    <div class="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8c8a84]">Filter</div>
    <div class="space-y-3">
      <label id="filter-type-select-field" class="advanced-select-field flex flex-col gap-2 rounded-xl border border-[#d7d6d0] bg-white p-2.5">
        <span class="advanced-select-label text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">Response</span>
        <select
          id="filter-type-select"
          aria-label="Response"
          value={params.filterType}
          onchange={(e) => onChange('filterType', (e.target as HTMLSelectElement).value as FilterType)}
          class="advanced-select-input rounded-lg border border-[#d7d6d0] bg-[#faf9f5] px-3 py-1.5 text-[13px] text-[#111] outline-none transition-colors focus:border-[#ff4a00]"
        >
          {#each filterOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <div id="filter-response-grid" class="filter-response-grid grid grid-cols-2 gap-3">
        <div id="filter-cutoff-knob-field" class="advanced-knob-field rounded-xl border border-[#d7d6d0] bg-[#faf9f5] p-2.5">
          <Knob
            id="filter-cutoff-knob"
            ariaLabel="Filter cutoff frequency"
            label="Cutoff"
            value={params.filterCutoff}
            displayValue={formatFrequency(toFilterCutoffFrequency(params.filterCutoff))}
            defaultValue={0.7}
            size="xs"
            onChange={(value) => onChange('filterCutoff', value)}
          />
        </div>
        <div id="filter-resonance-knob-field" class="advanced-knob-field rounded-xl border border-[#d7d6d0] bg-[#faf9f5] p-2.5">
          <Knob
            id="filter-resonance-knob"
            ariaLabel="Filter resonance"
            label="Resonance"
            value={params.filterQ}
            displayValue={`${toFilterQ(params.filterQ).toFixed(1)} Q`}
            defaultValue={0.18}
            size="xs"
            onChange={(value) => onChange('filterQ', value)}
          />
        </div>
      </div>
    </div>
  </section>

  <section
    id="engine-parameter-section"
    class="engine-parameter-section rounded-[1.25rem] border border-[#dfdfdd] bg-white p-3"
  >
    <div class="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8c8a84]">
      {engineLabels[resolvedEngine as keyof typeof engineLabels]}
    </div>
    <div id="advanced-parameter-grid" class="advanced-parameter-grid grid grid-cols-2 gap-3">
      {#each synthSpecificDefinitions as definition (`${resolvedEngine}-${definition.key}-${definition.label}`)}
        <div id={`${definition.key}-advanced-knob-field`} class="advanced-knob-field rounded-xl border border-[#d7d6d0] bg-[#faf9f5] p-2.5">
          <Knob
            id={`${definition.key}-advanced-knob`}
            ariaLabel={definition.ariaLabel}
            label={definition.label}
            value={params[definition.key]}
            displayValue={definition.displayValue(params)}
            defaultValue={definition.defaultValue}
            size="xs"
            onChange={(value) => onChange(definition.key, value)}
          />
        </div>
      {/each}
    </div>
  </section>
</aside>
