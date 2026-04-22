<script lang="ts">
  import { Layers2 } from 'lucide-svelte';
  import type { AudioParams, FilterType, NoiseType, ResolvedSynthEngine, SynthOscillatorType } from '../../types';
  import {
    engineLabels,
    filterOptions,
    formatFrequency,
    noiseTypeOptions,
    oscillatorOptions,
    toFatSpreadCents,
    toFatVoiceCount,
    toFilterCutoffFrequency,
    toNoisePlaybackRate,
    toPluckAttackNoise,
    toPluckDampeningFrequency,
    toFilterQ,
    toGrainOverlapSeconds,
    toGrainSizeSeconds,
    toMonoFilterEnvelopeRange,
    toPolyDetuneCents,
    toPolyVoiceCount,
    toPortamentoSeconds
  } from '../../audioConfig';
  import Knob from '../Knob.svelte';

  let { params, onChange, resolvedEngine, availableSampleNotes, onSampleUpload, onClearUploadedSamples } = $props<{
    params: AudioParams;
    onChange: <K extends keyof AudioParams>(key: K, value: AudioParams[K]) => void;
    resolvedEngine: ResolvedSynthEngine;
    availableSampleNotes: string[];
    onSampleUpload: (files: FileList | null) => void;
    onClearUploadedSamples: () => void;
  }>();

  type AdvancedKnobParamKey =
    | 'pitch'
    | 'decay'
    | 'brightness'
    | 'character'
    | 'filterCutoff'
    | 'filterQ'
    | 'noisePlaybackRate'
    | 'pluckAttackNoise'
    | 'pluckDampening'
    | 'pluckResonance';

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
      case 'mono':
        return [
          ...commonControls,
          {
            key: 'brightness',
            label: 'Filter Env',
            ariaLabel: 'Mono synth filter envelope range',
            defaultValue: 0.7,
            displayValue: (params) => `${toMonoFilterEnvelopeRange(params.brightness).toFixed(1)} oct`
          },
          {
            key: 'character',
            label: 'Glide',
            ariaLabel: 'Mono synth portamento',
            defaultValue: 0.2,
            displayValue: (params) => `${toPortamentoSeconds(params.character).toFixed(2)}s`
          }
        ];
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
            displayValue: (params) => `${(0.5 + params.brightness * 4.5).toFixed(2)}x`
          },
          {
            key: 'character',
            label: 'Depth',
            ariaLabel: 'AM modulation depth',
            defaultValue: 0.2,
            displayValue: (params) => `${Math.round((0.25 + params.character * 0.75) * 100)}%`
          }
        ];
      case 'poly':
        return [
          ...commonControls,
          {
            key: 'brightness',
            label: 'Detune',
            ariaLabel: 'Poly synth detune amount',
            defaultValue: 0.2,
            displayValue: (params) => `${Math.round(toPolyDetuneCents(params.brightness))} ct`
          },
          {
            key: 'character',
            label: 'Voices',
            ariaLabel: 'Poly synth voice count',
            defaultValue: 0.4,
            displayValue: (params) => `${toPolyVoiceCount(params.character)}`
          }
        ];
      case 'fat':
        return [
          ...commonControls,
          {
            key: 'brightness',
            label: 'Spread',
            ariaLabel: 'Fat oscillator spread',
            defaultValue: 0.35,
            displayValue: (params) => `${Math.round(toFatSpreadCents(params.brightness))} ct`
          },
          {
            key: 'character',
            label: 'Voices',
            ariaLabel: 'Fat oscillator voice count',
            defaultValue: 0.3,
            displayValue: (params) => `${toFatVoiceCount(params.character)}`
          }
        ];
      case 'pluck':
        return [
          ...commonControls,
          {
            key: 'pluckAttackNoise',
            label: 'Attack',
            ariaLabel: 'Pluck attack noise',
            defaultValue: 0.43,
            displayValue: (params) => `${toPluckAttackNoise(params.pluckAttackNoise).toFixed(2)}`
          },
          {
            key: 'pluckDampening',
            label: 'Damp',
            ariaLabel: 'Pluck dampening frequency',
            defaultValue: 0.56,
            displayValue: (params) => formatFrequency(toPluckDampeningFrequency(params.pluckDampening))
          },
          {
            key: 'pluckResonance',
            label: 'Resonance',
            ariaLabel: 'Pluck resonance',
            defaultValue: 0.7,
            displayValue: (params) => `${params.pluckResonance.toFixed(2)}`
          }
        ];
      case 'noise':
        return [
          ...commonControls,
          {
            key: 'noisePlaybackRate',
            label: 'Rate',
            ariaLabel: 'Noise playback rate',
            defaultValue: 0.5,
            displayValue: (params) => `${toNoisePlaybackRate(params.noisePlaybackRate).toFixed(2)}x`
          }
        ];
      case 'metal':
        return [
          ...commonControls,
          {
            key: 'brightness',
            label: 'Harmonicity',
            ariaLabel: 'Metal synth harmonicity',
            defaultValue: 0.6,
            displayValue: (params) => `${(1 + params.brightness * 7).toFixed(2)}x`
          },
          {
            key: 'character',
            label: 'Mod Idx',
            ariaLabel: 'Metal modulation index',
            defaultValue: 0.3,
            displayValue: (params) => `${(8 + params.character * 60).toFixed(0)}`
          }
        ];
      case 'membrane':
        return [
          ...commonControls,
          {
            key: 'brightness',
            label: 'Pitch Decay',
            ariaLabel: 'Membrane pitch decay',
            defaultValue: 0.4,
            displayValue: (params) => `${(0.01 + params.brightness * 0.2).toFixed(2)}s`
          },
          {
            key: 'character',
            label: 'Octaves',
            ariaLabel: 'Membrane octaves',
            defaultValue: 0.4,
            displayValue: (params) => `${(1 + params.character * 8).toFixed(1)}`
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
      case 'grain':
        return [
          ...commonControls,
          {
            key: 'brightness',
            label: 'Grain Size',
            ariaLabel: 'Grain size',
            defaultValue: 0.35,
            displayValue: (params) => `${toGrainSizeSeconds(params.brightness).toFixed(2)}s`
          },
          {
            key: 'character',
            label: 'Overlap',
            ariaLabel: 'Grain overlap',
            defaultValue: 0.2,
            displayValue: (params) => `${toGrainOverlapSeconds(params.character).toFixed(2)}s`
          }
        ];
      case 'sampler':
        return commonControls;
      case 'synth':
      default:
        return commonControls;
    }
  };

  let parameterDefinitions = $derived(getContextualParameterDefinitions(resolvedEngine));
  let synthSpecificDefinitions = $derived(parameterDefinitions.filter(
    (definition) => definition.key !== 'filterCutoff' && definition.key !== 'filterQ'
  ));
  let fileInputElement = $state<HTMLInputElement | null>(null);
  let usesSampleSource = $derived(resolvedEngine === 'sampler' || resolvedEngine === 'grain');
  let usesNoiseSource = $derived(resolvedEngine === 'noise');
  let usesOscillatorControls = $derived(!usesSampleSource && !usesNoiseSource && resolvedEngine !== 'pluck');
  let showsVoiceSection = $derived(usesSampleSource || usesNoiseSource || usesOscillatorControls);
  let supportsSecondaryVoice = $derived(
    resolvedEngine === 'fm' || resolvedEngine === 'am' || resolvedEngine === 'polyfm' || resolvedEngine === 'duo'
  );
  let oscillatorLabel = $derived(
    resolvedEngine === 'duo'
      ? 'Voice A'
      : resolvedEngine === 'fm' || resolvedEngine === 'am' || resolvedEngine === 'polyfm'
        ? 'Carrier'
        : resolvedEngine === 'fat'
          ? 'Shape'
        : 'Oscillator'
  );
  let modulatorLabel = $derived(resolvedEngine === 'duo' ? 'Voice B' : 'Modulator');
  let samplePanelTitle = $derived(resolvedEngine === 'grain' ? 'Source' : 'Sample');
  let voicePanelTitle = $derived(
    usesSampleSource ? samplePanelTitle : usesNoiseSource ? 'Noise' : 'Voice'
  );
  let sampleStatusLabel = $derived(
    params.sampleSource === 'upload' && Object.keys(params.uploadedSampleUrls).length > 0
      ? params.uploadedSampleLabel || `${availableSampleNotes.length} samples`
      : 'Stock Piano'
  );
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

  {#if showsVoiceSection}
    <section
      id="voice-control-panel"
      class="voice-control-panel rounded-[1.25rem] border border-[#dfdfdd] bg-white p-3"
    >
      <div class="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8c8a84]">
        {voicePanelTitle}
      </div>
      {#if usesSampleSource}
        <div class="space-y-3">
          <label id="sample-source-select-field" class="advanced-select-field flex flex-col gap-2 rounded-xl border border-[#d7d6d0] bg-white p-2.5">
            <span class="advanced-select-label text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">Source</span>
            <select
              id="sample-source-select"
              aria-label="Sample source"
              value={params.sampleSource}
              onchange={(e) => onChange('sampleSource', (e.target as HTMLSelectElement).value as AudioParams['sampleSource'])}
              class="advanced-select-input rounded-lg border border-[#d7d6d0] bg-[#faf9f5] px-3 py-1.5 text-[13px] text-[#111] outline-none transition-colors focus:border-[#ff4a00]"
            >
              <option value="stock">Stock Piano</option>
              <option value="upload">Uploaded Samples</option>
            </select>
          </label>

          <label id="sample-root-note-field" class="advanced-select-field flex flex-col gap-2 rounded-xl border border-[#d7d6d0] bg-white p-2.5">
            <span class="advanced-select-label text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">Root Note</span>
            <select
              id="sample-root-note-select"
              aria-label="Sample root note"
              value={params.sampleRootNote}
              onchange={(e) => onChange('sampleRootNote', (e.target as HTMLSelectElement).value)}
              class="advanced-select-input rounded-lg border border-[#d7d6d0] bg-[#faf9f5] px-3 py-1.5 text-[13px] text-[#111] outline-none transition-colors focus:border-[#ff4a00]"
            >
              {#each availableSampleNotes as note}
                <option value={note}>{note}</option>
              {/each}
            </select>
          </label>

          <div id="sample-upload-panel" class="sample-upload-panel rounded-xl border border-[#d7d6d0] bg-[#faf9f5] p-2.5">
            <div class="mb-2 flex items-center justify-between gap-2">
              <span class="text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">Library</span>
              <span class="truncate text-[11px] font-medium text-[#5e5b55]">{sampleStatusLabel}</span>
            </div>
            <div class="flex gap-2">
              <input
                id="sample-upload-input"
                bind:this={fileInputElement}
                type="file"
                accept="audio/*"
                multiple
                class="hidden"
                onchange={(e) => {
                  onSampleUpload((e.target as HTMLInputElement).files);
                  (e.target as HTMLInputElement).value = '';
                }}
              />
              <button
                id="sample-upload-button"
                type="button"
                onclick={() => fileInputElement?.click()}
                class="flex-1 rounded-lg border border-[#d7d6d0] bg-white px-3 py-2 text-[12px] font-medium text-[#111] transition-colors hover:border-[#ff4a00] hover:text-[#ff4a00]"
              >
                Upload
              </button>
              {#if Object.keys(params.uploadedSampleUrls).length > 0}
                <button
                  id="clear-sample-upload-button"
                  type="button"
                  onclick={onClearUploadedSamples}
                  class="rounded-lg border border-[#d7d6d0] bg-white px-3 py-2 text-[12px] font-medium text-[#5e5b55] transition-colors hover:border-[#111] hover:text-[#111]"
                >
                  Clear
                </button>
              {/if}
            </div>
          </div>
        </div>
      {:else if usesNoiseSource}
        <label id="noise-type-select-field" class="advanced-select-field flex flex-col gap-2 rounded-xl border border-[#d7d6d0] bg-white p-2.5">
          <span class="advanced-select-label text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">Noise Type</span>
          <select
            id="noise-type-select"
            aria-label="Noise type"
            value={params.noiseType}
            onchange={(e) => onChange('noiseType', (e.target as HTMLSelectElement).value as NoiseType)}
            class="advanced-select-input rounded-lg border border-[#d7d6d0] bg-[#faf9f5] px-3 py-1.5 text-[13px] text-[#111] outline-none transition-colors focus:border-[#ff4a00]"
          >
            {#each noiseTypeOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
      {:else}
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
      {/if}
    </section>
  {/if}

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
