<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as Tone from 'tone';
  import { Wand2, Activity, Keyboard } from 'lucide-svelte';
  import { slide } from 'svelte/transition';
  import type { AudioParams, RecipeType, Variant } from './types';
  import {
    defaultAudioParams,
    getAvailableSampleNotes,
    getResolvedSampleRootNote,
    syncBrightnessToCutoff
  } from './audioConfig';
  import {
    getEngineTypeForRecipe,
    getResolvedEngine,
    playSound,
    releaseAllPerformanceNotes,
    releasePerformanceNote,
    teardownPerformanceInstrument,
    triggerPerformanceNote,
    updateActiveParams,
    updatePerformanceInstrument
  } from './services/audioEngine';
  import { exportWav } from './services/wavExporter';
  import { generateVariantsFromPrompt } from './services/nlpEngine';
  import WaveformVis from './components/WaveformVis.svelte';
  import RecipeSelector from './components/RecipeSelector.svelte';
  import ParameterGrid from './components/ParameterGrid.svelte';
  import Transport from './components/Transport.svelte';
  import AdvancedEngineSidebar from './components/AdvancedControls/AdvancedEngineSidebar.svelte';
  import AdvancedEnvelopePanel from './components/AdvancedControls/AdvancedEnvelopePanel.svelte';
  import AdvancedSynthParametersPanel from './components/AdvancedControls/AdvancedSynthParametersPanel.svelte';
  import MusicalTypingKeyboard from './components/MusicalTypingKeyboard.svelte';
  import ToggleSwitch from './components/ToggleSwitch.svelte';
  import { MUSICAL_TYPING_KEYMAP } from './musicalTyping';
  import { inferSampleNoteFromFilename, sortSampleNotes } from './sampleUtils';

  let recipe = $state<RecipeType>('bloop');
  let params = $state<AudioParams>({ ...defaultAudioParams });
  let prompt = $state("");
  let variants = $state<Variant[]>([]);
  let isAudioStarted = $state(false);
  let isKeyboardVisible = $state(false);
  let activePerformanceNotes = $state<number[]>([]);
  let isMidiEnabled = $state(false);
  let midiInputNames = $state<string[]>([]);
  let midiError = $state<string | null>(null);
  let isGenerating = $state(false);

  let isAdvancedMode = $state(
    typeof window !== 'undefined' ? window.localStorage.getItem('augment:advanced-mode') === 'true' : false
  );

  const midiSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

  let activePerformanceSources = new Map<number, Set<string>>();
  let midiAccess: MIDIAccess | null = null;
  let checkStateInterval: number;

  const resolvedEngine = $derived(getResolvedEngine(recipe as any, params.engine as any));
  const advancedSelectedEngine = $derived(params.engine === 'auto' ? resolvedEngine : params.engine);
  const availableSampleNotes = $derived(getAvailableSampleNotes(params));

  const revokeUploadedSampleUrls = (urls: Record<string, string>) => {
    for (const url of Object.values(urls)) {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    }
  };

  $effect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('augment:advanced-mode', String(isAdvancedMode));
    }
    if (!isAdvancedMode && isKeyboardVisible) {
      isKeyboardVisible = false;
    }
  });

  const getModeScopedParams = (sourceParams: AudioParams = params) => {
    if (isAdvancedMode) return sourceParams;
    return syncBrightnessToCutoff({ ...sourceParams, engine: 'auto' as const });
  };

  $effect(() => {
    updateActiveParams(getModeScopedParams());
    if (isAdvancedMode) {
      void updatePerformanceInstrument(recipe, getModeScopedParams());
    } else if (activePerformanceSources.size > 0 || activePerformanceNotes.length > 0) {
      clearPerformanceSources();
      teardownPerformanceInstrument();
    }
  });

  $effect(() => {
    const resolvedRootNote = getResolvedSampleRootNote(params);
    if (params.sampleRootNote !== resolvedRootNote) {
      params = { ...params, sampleRootNote: resolvedRootNote };
    }
  });

  const clearPerformanceSources = () => {
    activePerformanceSources = new Map();
    activePerformanceNotes = [];
    releaseAllPerformanceNotes();
  };

  const cleanupMidiAccess = (access: MIDIAccess | null = midiAccess) => {
    if (!access) return;

    access.onstatechange = null;
    for (const input of access.inputs.values()) {
      input.onmidimessage = null;
    }

    if (access === midiAccess) {
      midiAccess = null;
    }
  };

  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

  const handleAdvancedModeChange = (nextValue: boolean) => {
    isAdvancedMode = nextValue;

    if (!nextValue) {
      clearPerformanceSources();
      teardownPerformanceInstrument();
    }
  };

  onDestroy(() => {
    revokeUploadedSampleUrls(params.uploadedSampleUrls);
    cleanupMidiAccess();
  });

  onMount(() => {
    checkStateInterval = window.setInterval(() => {
      isAudioStarted = Tone.getContext().state === 'running';
    }, 1000);

    return () => {
      window.clearInterval(checkStateInterval);
      releaseAllPerformanceNotes();
      teardownPerformanceInstrument();
    };
  });

  const syncActivePerformanceState = () => {
    const activeNotes = [...activePerformanceSources.keys()];
    activeNotes.sort((a, b) => a - b);
    activePerformanceNotes = activeNotes;
  };

  const engagePerformanceNote = (midi: number, sourceId: string, velocity = 0.88) => {
    if (!isAdvancedMode) return;

    const currentSources = activePerformanceSources.get(midi) ?? new Set<string>();
    if (currentSources.has(sourceId)) return;

    const isFirstSource = currentSources.size === 0;
    currentSources.add(sourceId);
    activePerformanceSources.set(midi, currentSources);
    syncActivePerformanceState();

    if (isFirstSource) {
      isAudioStarted = true;
      void triggerPerformanceNote(recipe as any, params, midi, velocity);
    }
  };

  const releasePerformanceSource = (midi: number, sourceId: string) => {
    const currentSources = activePerformanceSources.get(midi);
    if (!currentSources || !currentSources.has(sourceId)) return;

    currentSources.delete(sourceId);

    if (currentSources.size === 0) {
      activePerformanceSources.delete(midi);
      releasePerformanceNote(midi);
    } else {
      activePerformanceSources.set(midi, currentSources);
    }

    syncActivePerformanceState();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isInteractiveTarget(event.target)) return;

    const key = event.key.toLowerCase();
    const musicalTypingNote = isAdvancedMode ? MUSICAL_TYPING_KEYMAP[key] : undefined;

    if (musicalTypingNote) {
      if (!event.repeat) {
        event.preventDefault();
        engagePerformanceNote(musicalTypingNote.midi, `keyboard:${musicalTypingNote.midi}`);
      }
      return;
    }

    if (key === ' ') {
      event.preventDefault();
      void handlePlay();
      return;
    } else if (key === 'r') {
      void handleRandomize();
      return;
    } else if (key === 'e') {
      exportWav(recipe as any, getModeScopedParams());
      return;
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (!isAdvancedMode) return;
    const key = event.key.toLowerCase();
    const note = MUSICAL_TYPING_KEYMAP[key];

    if (note) {
      event.preventDefault();
      releasePerformanceSource(note.midi, `keyboard:${note.midi}`);
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });

  const refreshMidiInputs = (access: MIDIAccess) => {
    const inputs = Array.from(access.inputs.values()).filter((input) => input.state === 'connected');
    const names = inputs.map((input) => input.name || 'Unknown MIDI Device');
    midiInputNames = names;

    for (const input of access.inputs.values()) {
      input.onmidimessage = null;
    }

    for (const input of inputs) {
      input.onmidimessage = (event) => {
        if (!isAdvancedMode || !event.data) return;

        const [statusByte, data1, data2 = 0] = event.data;
        const messageType = statusByte & 0xf0;
        const midiChannel = statusByte & 0x0f;
        const sourceId = `midi:${input.id}:${midiChannel}:${data1}`;

        if (messageType === 0x90) {
          const velocity = data2 / 127;
          if (velocity > 0) {
            engagePerformanceNote(data1, sourceId, velocity);
          } else {
            releasePerformanceSource(data1, sourceId);
          }
        } else if (messageType === 0x80) {
          releasePerformanceSource(data1, sourceId);
        }
      };
    }
  };

  const enableMidi = async () => {
    if (!midiSupported) {
      midiError = 'Web MIDI API is not supported in this browser.';
      return;
    }

    try {
      midiError = null;
      cleanupMidiAccess();
      const access = await navigator.requestMIDIAccess();
      midiAccess = access;
      isMidiEnabled = true;

      refreshMidiInputs(access);

      access.onstatechange = (event) => {
        const port = (event as any).port;
        if (port?.type === 'input') {
          refreshMidiInputs(access);
        }
      };
    } catch (err) {
      midiError = 'Failed to access MIDI devices. Permission may have been denied.';
      isMidiEnabled = false;
      console.error('MIDI access error:', err);
    }
  };

  const handlePlay = async () => {
    await Tone.start();
    isAudioStarted = true;
    await playSound(recipe as any, getModeScopedParams());
  };

  const handleRandomize = async () => {
    const randomizedParams = {
      ...params,
      pitch: Math.random(),
      decay: Math.random(),
      brightness: Math.random(),
      character: Math.random()
    };
    const nextParams = isAdvancedMode ? randomizedParams : syncBrightnessToCutoff(randomizedParams);
    params = nextParams;

    await Tone.start();
    isAudioStarted = true;
    await playSound(recipe as any, getModeScopedParams(nextParams));
  };

  const handleRecipeSelect = async (r: RecipeType) => {
    recipe = r;
    await Tone.start();
    isAudioStarted = true;
    await playSound(r, getModeScopedParams());
  };

  const handleParamChange = <K extends keyof AudioParams>(key: K, val: AudioParams[K]) => {
    const p = { ...params };
    p[key] = val;
    if (!isAdvancedMode && key === 'brightness') {
      const finalParams = syncBrightnessToCutoff(p);
      params = finalParams;
    } else {
      params = p;
    }
  };

  const handleSampleUpload = (files: FileList | null) => {
    if (!files?.length) return;

    const nextUrls: Record<string, string> = {};
    Array.from(files).forEach((file, index) => {
      const note = inferSampleNoteFromFilename(file.name, index);
      nextUrls[note] = URL.createObjectURL(file);
    });

    const nextNotes = sortSampleNotes(Object.keys(nextUrls));
    const nextRootNote = nextNotes.includes(params.sampleRootNote) ? params.sampleRootNote : nextNotes[0] ?? 'C4';

    revokeUploadedSampleUrls(params.uploadedSampleUrls);
    params = {
      ...params,
      sampleSource: 'upload',
      uploadedSampleUrls: nextUrls,
      uploadedSampleLabel: files.length === 1 ? files[0].name : `${files.length} samples`,
      sampleRootNote: nextRootNote
    };
  };

  const clearUploadedSamples = () => {
    revokeUploadedSampleUrls(params.uploadedSampleUrls);
    const nextParams = {
      ...params,
      sampleSource: 'stock' as const,
      uploadedSampleUrls: {},
      uploadedSampleLabel: '',
      sampleRootNote: defaultAudioParams.sampleRootNote
    };
    params = {
      ...nextParams,
      sampleRootNote: getResolvedSampleRootNote(nextParams)
    };
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    isGenerating = true;
    try {
      const results = await generateVariantsFromPrompt(prompt, recipe as any, getModeScopedParams());
      variants = results;
    } catch (e) {
      console.error(e);
    } finally {
      isGenerating = false;
    }
  };

  const handleApplyVariant = async (v: Variant) => {
    recipe = v.recipe;
    params = isAdvancedMode ? v.params : syncBrightnessToCutoff(v.params);
    await Tone.start();
    isAudioStarted = true;
    const nextParams = isAdvancedMode ? v.params : syncBrightnessToCutoff({ ...v.params, engine: 'auto' });
    await playSound(v.recipe as any, nextParams);
  };

  const getRecipeLabel = (r: RecipeType) => {
    return r.charAt(0).toUpperCase() + r.slice(1);
  };
</script>

<div id="app-shell" class="app-shell min-h-screen bg-[#efede7] p-2 md:h-screen md:p-3 font-sans text-[#111]">
  <div
    id="app-window"
    class="app-window mx-auto flex min-h-[calc(100svh-1rem)] w-full flex-col overflow-hidden rounded-[1.75rem] border border-[#dfdfdd] bg-[#fcfcfc] shadow-[0_20px_60px_rgba(0,0,0,0.08),_inset_0_1px_1px_rgba(255,255,255,1)] md:h-[calc(100svh-1.5rem)] md:min-h-0"
  >
    <div id="app-header" class="app-header shrink-0 border-b border-[#dfdfdd] bg-[#fcfcfc] px-4 py-3 md:px-5">
      <div class="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div id="engine-status" class="engine-status flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#aaa]">
          <Activity size={12} class={isAudioStarted ? "text-[#ff4a00]" : "text-[#ccc]"} />
          <span>Engine: {getEngineTypeForRecipe(recipe as any, getModeScopedParams().engine)}</span>
        </div>
        <h1 id="app-title" class="text-center text-xl font-bold tracking-tighter text-[#111] md:text-2xl">AUGMENT</h1>
        <div id="mode-toggle-region" class="mode-toggle-region flex justify-start md:justify-end">
          <ToggleSwitch
            checked={isAdvancedMode}
            onChange={handleAdvancedModeChange}
            label="Advanced"
          />
        </div>
      </div>
    </div>

    {#if isAdvancedMode}
      <div
        id="advanced-mode-panel"
        class="advanced-mode-panel flex flex-1 flex-col overflow-y-auto border-b border-[#dfdfdd] bg-[#f4f4f2] md:min-h-0 md:grid md:grid-cols-[14rem_minmax(0,1fr)_23rem] md:overflow-hidden lg:grid-cols-[15rem_minmax(0,1fr)_25rem]"
      >
        <AdvancedEngineSidebar
          {params}
          onChange={handleParamChange}
          {resolvedEngine}
          selectedEngine={advancedSelectedEngine}
          recipeLabel={getRecipeLabel(recipe)}
        />

        <div
          id="advanced-center-panel"
          class="advanced-center-panel flex min-h-[28rem] flex-1 flex-col gap-3 overflow-hidden bg-[#f4f4f2] p-4 md:min-h-0 md:min-w-0 md:p-5"
        >
          <div
            id="waveform-panel"
            class="waveform-panel relative flex h-[8.75rem] items-center justify-center overflow-hidden rounded-[1.35rem] border-4 border-[#333] bg-[#1a1a1a] shadow-inner md:h-[9.5rem] lg:h-[10.5rem]"
          >
            <WaveformVis />
          </div>

          <div
            id="advanced-envelope-section"
            class="advanced-envelope-section flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-[#dfdfdd] bg-[#fafafa] p-3.5 md:p-4"
          >
            <AdvancedEnvelopePanel
              {params}
              onChange={handleParamChange}
              onPatch={(patch) => {
                const p = { ...params, ...patch };
                params = p;
              }}
            />
          </div>
        </div>

        <AdvancedSynthParametersPanel
          {params}
          onChange={handleParamChange}
          {resolvedEngine}
          {availableSampleNotes}
          onSampleUpload={handleSampleUpload}
          onClearUploadedSamples={clearUploadedSamples}
        />
      </div>
    {:else}
      <div
        id="macro-mode-panel"
        class="macro-mode-panel flex flex-1 flex-col overflow-y-auto border-b border-[#dfdfdd] bg-[#f4f4f2] md:min-h-0 md:grid md:grid-cols-[16rem_minmax(0,1fr)_28rem] md:overflow-hidden"
      >
        <div id="macro-library-panel" class="macro-library-panel flex flex-col gap-2 bg-[#f4f4f2] p-4 md:border-r md:border-[#dfdfdd] md:p-6">
          <RecipeSelector currentRecipe={recipe} onSelect={handleRecipeSelect} />
        </div>

        <div id="macro-center-panel" class="macro-center-panel flex min-h-[24rem] flex-1 flex-col p-4 md:min-h-0 md:p-6">
          <div id="prompt-generate-bar" class="prompt-generate-bar mb-6 flex gap-2">
            <input
              id="sound-prompt-input"
              type="text"
              placeholder='e.g., "a cute snappy success"'
              value={prompt}
              oninput={(e) => prompt = e.currentTarget.value}
              onkeydown={(e) => e.key === 'Enter' && handleGenerate()}
              aria-label="Sound prompt"
              class="flex-1 rounded-lg border border-[#d0d0d0] bg-white px-4 py-2 text-sm transition-all focus:border-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]"
            />
            <button
              id="generate-sound-button"
              onclick={handleGenerate}
              aria-label="Generate sound variants from prompt"
              disabled={isGenerating || !prompt.trim()}
              class="flex items-center gap-2 rounded-lg border border-[#d0d0d0] bg-[#f0f0f0] px-4 text-sm font-medium text-[#111] transition-colors hover:bg-[#e4e4e4] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wand2 size={16} /> {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {#if variants.length > 0}
            <div
              transition:slide|local={{ duration: 300 }}
              id="variant-selector-row"
              class="variant-selector-row mb-4 flex gap-2 overflow-x-auto pb-2"
            >
              {#each variants as v}
                <button
                  onclick={() => handleApplyVariant(v)}
                  class="whitespace-nowrap bg-[#fff] border border-[#d0d0d0] text-xs px-3 py-1.5 rounded-full hover:border-[#ff4a00] hover:text-[#ff4a00] transition-colors"
                >
                  {v.name}
                </button>
              {/each}
            </div>
          {/if}

          <div id="macro-waveform-panel" class="waveform-panel relative flex min-h-[200px] flex-1 items-center justify-center overflow-hidden rounded-xl border-4 border-[#333] bg-[#1a1a1a] shadow-inner">
            <WaveformVis />
          </div>
        </div>

        <div id="macro-parameter-panel" class="macro-parameter-panel bg-[#fafafa] p-4 md:min-h-0 md:overflow-y-auto md:border-l md:border-[#dfdfdd] md:p-6">
          <div class="mb-6">
            <h2 class="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">Parameters</h2>
            <p class="mt-2 text-sm text-[#666]">
              Macro shaping stays on the front panel. Advanced mode opens the raw Tone.js synth controls.
            </p>
          </div>

          <div>
            <div class="mb-5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#a5a5a0]">Macro Controls</div>
            <ParameterGrid {params} onChange={handleParamChange} />
          </div>
        </div>
      </div>
    {/if}

    <div id="app-footer" class="app-footer shrink-0 bg-[#fcfcfc]">
      {#if isAdvancedMode && isKeyboardVisible}
        <div
          transition:slide|local={{ duration: 280, axis: 'y' }}
          id="musical-typing-drawer"
          class="musical-typing-drawer border-t border-[#d7d6d0] bg-[rgba(250,250,248,0.98)] px-3 py-3 shadow-[0_-18px_40px_rgba(0,0,0,0.08)] backdrop-blur-md md:px-4"
        >
          <MusicalTypingKeyboard
            activeNotes={activePerformanceNotes}
            {midiSupported}
            midiEnabled={isMidiEnabled}
            {midiInputNames}
            {midiError}
            onEnableMidi={enableMidi}
            onNoteAttack={engagePerformanceNote}
            onNoteRelease={releasePerformanceSource}
          />
        </div>
      {/if}

      <Transport
        onPlay={handlePlay}
        onRandomize={handleRandomize}
        onExport={() => exportWav(recipe as any, getModeScopedParams())}
      >
        {#snippet centerContent()}
          {#if isAdvancedMode}
            <button
              id="musical-typing-toggle"
              type="button"
              aria-expanded={isKeyboardVisible}
              aria-controls="musical-typing-drawer"
              aria-label={isKeyboardVisible ? 'Hide musical typing keyboard' : 'Show musical typing keyboard'}
              onclick={() => isKeyboardVisible = !isKeyboardVisible}
              class="musical-typing-toggle inline-flex h-11 items-center gap-2 rounded-full border border-[#d7d4cb] bg-white px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5d5c57] transition-colors hover:bg-[#f5f3ed]"
            >
              <Keyboard size={12} />
              <span>{isKeyboardVisible ? 'Hide Musical Typing' : 'Show Musical Typing'}</span>
            </button>
          {/if}
        {/snippet}
      </Transport>
    </div>
  </div>
</div>
