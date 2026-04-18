import { useState, useEffect, useMemo, useRef } from 'react';
import * as Tone from 'tone';
import { Wand2, Activity, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioParams, RecipeType, Variant } from './types';
import { defaultAudioParams, syncBrightnessToCutoff } from './audioConfig';
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
import { WaveformVis } from './components/WaveformVis';
import { RecipeSelector } from './components/RecipeSelector';
import { ParameterGrid } from './components/ParameterGrid';
import { Transport } from './components/Transport';
import {
  AdvancedEngineSidebar,
  AdvancedEnvelopePanel,
  AdvancedSynthParametersPanel
} from './components/AdvancedControls';
import { MusicalTypingKeyboard } from './components/MusicalTypingKeyboard';
import { ToggleSwitch } from './components/ToggleSwitch';
import { MUSICAL_TYPING_KEYMAP, MUSICAL_TYPING_NOTES } from './musicalTyping';

export default function App() {
  const [recipe, setRecipe] = useState<RecipeType>('bloop');
  const [params, setParams] = useState<AudioParams>(defaultAudioParams);
  const [prompt, setPrompt] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [activePerformanceNotes, setActivePerformanceNotes] = useState<number[]>([]);
  const [midiSupported] = useState(() => typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator);
  const [isMidiEnabled, setIsMidiEnabled] = useState(false);
  const [midiInputNames, setMidiInputNames] = useState<string[]>([]);
  const [midiError, setMidiError] = useState<string | null>(null);
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('augment:advanced-mode') === 'true';
  });
  const paramsRef = useRef(params);
  const recipeRef = useRef(recipe);
  const isAdvancedModeRef = useRef(isAdvancedMode);
  const activePerformanceSourcesRef = useRef<Map<number, Set<string>>>(new Map());
  const midiAccessRef = useRef<MIDIAccess | null>(null);

  useEffect(() => {
    const checkState = () => {
      setIsAudioStarted(Tone.getContext().state === 'running');
    };
    const interval = setInterval(checkState, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('augment:advanced-mode', String(isAdvancedMode));
  }, [isAdvancedMode]);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    recipeRef.current = recipe;
  }, [recipe]);

  useEffect(() => {
    isAdvancedModeRef.current = isAdvancedMode;
  }, [isAdvancedMode]);

  useEffect(() => {
    if (!isAdvancedMode) {
      setIsKeyboardVisible(false);
    }
  }, [isAdvancedMode]);

  const syncActivePerformanceState = () => {
    const activeNotes = [...activePerformanceSourcesRef.current.keys()];
    activeNotes.sort((a, b) => a - b);
    setActivePerformanceNotes(activeNotes);
  };

  const engagePerformanceNote = (midi: number, sourceId: string, velocity = 0.88) => {
    if (!isAdvancedModeRef.current) return;

    const currentSources = activePerformanceSourcesRef.current.get(midi) ?? new Set<string>();
    if (currentSources.has(sourceId)) return;

    const isFirstSource = currentSources.size === 0;
    currentSources.add(sourceId);
    activePerformanceSourcesRef.current.set(midi, currentSources);
    syncActivePerformanceState();

    if (isFirstSource) {
      setIsAudioStarted(true);
      void triggerPerformanceNote(recipeRef.current, paramsRef.current, midi, velocity);
    }
  };

  const releasePerformanceSource = (midi: number, sourceId: string) => {
    const currentSources = activePerformanceSourcesRef.current.get(midi);
    if (!currentSources || !currentSources.has(sourceId)) return;

    currentSources.delete(sourceId);

    if (currentSources.size === 0) {
      activePerformanceSourcesRef.current.delete(midi);
      releasePerformanceNote(midi);
    } else {
      activePerformanceSourcesRef.current.set(midi, currentSources);
    }

    syncActivePerformanceState();
  };

  const clearPerformanceSources = () => {
    activePerformanceSourcesRef.current.clear();
    setActivePerformanceNotes([]);
    releaseAllPerformanceNotes();
  };

  const getModeScopedParams = (sourceParams: AudioParams) =>
    isAdvancedMode ? sourceParams : { ...sourceParams, engine: 'auto' as const };

  const modeScopedParams = useMemo(() => getModeScopedParams(params), [isAdvancedMode, params]);

  const handlePlay = async () => {
    await Tone.start();
    setIsAudioStarted(true);
    playSound(recipe, modeScopedParams);
  };

  const handleRecipeSelect = async (newRecipe: RecipeType) => {
    await Tone.start();
    setIsAudioStarted(true);
    setRecipe(newRecipe);
    playSound(newRecipe, modeScopedParams);
  };

  const handleParamChange = <K extends keyof AudioParams>(key: K, val: AudioParams[K]) => {
    const candidateParams = { ...params, [key]: val } as AudioParams;
    const newParams = key === 'brightness' ? syncBrightnessToCutoff(candidateParams) : candidateParams;
    setParams(newParams);
    updateActiveParams(getModeScopedParams(newParams));
  };

  const handleParamPatch = (patch: Partial<AudioParams>) => {
    const candidateParams = { ...params, ...patch };
    const newParams = 'brightness' in patch ? syncBrightnessToCutoff(candidateParams) : candidateParams;
    setParams(newParams);
    updateActiveParams(getModeScopedParams(newParams));
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    const newVariants = generateVariantsFromPrompt(prompt, recipe, modeScopedParams);
    setVariants(newVariants);
  };

  const applyVariant = (v: Variant) => {
    setRecipe(v.recipe);
    setParams(v.params);
    playSound(v.recipe, getModeScopedParams(v.params));
  };

  const handleRandomize = () => {
    const randomParams = syncBrightnessToCutoff({
      ...params,
      pitch: Math.random(),
      decay: Math.random(),
      brightness: Math.random(),
      character: Math.random()
    });
    setParams(randomParams);
    playSound(recipe, getModeScopedParams(randomParams));
  };

  const refreshMidiInputs = (access: MIDIAccess) => {
    setMidiInputNames(
      Array.from(access.inputs.values())
        .filter((input) => input.state === 'connected')
        .map((input) => input.name || 'MIDI Input')
    );
  };

  const handleEnableMidi = async () => {
    if (!midiSupported) return;

    try {
      await Tone.start();
      setIsAudioStarted(true);

      const access = await navigator.requestMIDIAccess();
      midiAccessRef.current = access;
      setIsMidiEnabled(true);
      setMidiError(null);

      const attachMidiListeners = () => {
        access.inputs.forEach((input) => {
          input.onmidimessage = (event) => {
            if (!isAdvancedModeRef.current || !event.data) return;

            const [status, noteNumber, velocity = 0] = event.data;
            const command = status & 0xf0;
            const sourceId = `midi:${input.id}:${noteNumber}`;

            if (command === 0x90 && velocity > 0) {
              engagePerformanceNote(noteNumber, sourceId, velocity / 127);
              return;
            }

            if (command === 0x80 || (command === 0x90 && velocity === 0)) {
              releasePerformanceSource(noteNumber, sourceId);
            }
          };
        });

        refreshMidiInputs(access);
      };

      attachMidiListeners();
      access.onstatechange = () => {
        attachMidiListeners();
      };
    } catch {
      setMidiError('Unable to access MIDI.');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      const lowerKey = e.key.toLowerCase();
      if (isAdvancedMode && MUSICAL_TYPING_KEYMAP[lowerKey]) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlay();
      }
      if (e.key === 'r') handleRandomize();
      if (e.key === 'e') exportWav(recipe, modeScopedParams);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdvancedMode, recipe, params, modeScopedParams]);

  useEffect(() => {
    if (!isAdvancedMode) {
      clearPerformanceSources();
      teardownPerformanceInstrument();
      return;
    }

    updatePerformanceInstrument(recipe, params);
  }, [isAdvancedMode, recipe, params]);

  useEffect(() => {
    if (!isAdvancedMode) return;

    const handleTypingKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;

      const mappedNote = MUSICAL_TYPING_KEYMAP[event.key.toLowerCase()];
      if (!mappedNote) return;

      event.preventDefault();
      if (event.repeat) return;

      engagePerformanceNote(mappedNote.midi, `typing:${mappedNote.key}`, 0.88);
    };

    const handleTypingKeyUp = (event: KeyboardEvent) => {
      const mappedNote = MUSICAL_TYPING_KEYMAP[event.key.toLowerCase()];
      if (!mappedNote) return;

      releasePerformanceSource(mappedNote.midi, `typing:${mappedNote.key}`);
    };

    window.addEventListener('keydown', handleTypingKeyDown);
    window.addEventListener('keyup', handleTypingKeyUp);

    return () => {
      window.removeEventListener('keydown', handleTypingKeyDown);
      window.removeEventListener('keyup', handleTypingKeyUp);
      MUSICAL_TYPING_NOTES.forEach((note) => releasePerformanceSource(note.midi, `typing:${note.key}`));
    };
  }, [isAdvancedMode]);

  useEffect(() => {
    return () => {
      clearPerformanceSources();
      teardownPerformanceInstrument();

      if (midiAccessRef.current) {
        midiAccessRef.current.inputs.forEach((input) => {
          input.onmidimessage = null;
        });
        midiAccessRef.current.onstatechange = null;
      }
    };
  }, []);

  const resolvedEngine = getResolvedEngine(recipe, params.engine);
  const recipeLabel = recipe.charAt(0).toUpperCase() + recipe.slice(1);

  return (
    <div id="app-shell" className="app-shell min-h-screen bg-[#efede7] p-2 md:h-screen md:p-3">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        id="app-window"
        className="app-window mx-auto flex min-h-[calc(100svh-1rem)] w-full flex-col overflow-hidden rounded-[1.75rem] border border-[#dfdfdd] bg-[#fcfcfc] shadow-[0_20px_60px_rgba(0,0,0,0.08),_inset_0_1px_1px_rgba(255,255,255,1)] md:h-[calc(100svh-1.5rem)] md:min-h-0"
      >
        {/* Integrated Header */}
        <div id="app-header" className="app-header shrink-0 border-b border-[#dfdfdd] bg-[#fcfcfc] px-4 py-3 md:px-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div id="engine-status" className="engine-status flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#aaa]">
              <Activity size={12} className={isAudioStarted ? "text-[#ff4a00]" : "text-[#ccc]"} />
              <span>Engine: {getEngineTypeForRecipe(recipe, modeScopedParams.engine)}</span>
            </div>
            <h1 id="app-title" className="text-center text-xl font-bold tracking-tighter text-[#111] md:text-2xl">AUGMENT</h1>
            <div id="mode-toggle-region" className="mode-toggle-region flex justify-start md:justify-end">
              <ToggleSwitch
                checked={isAdvancedMode}
                onChange={setIsAdvancedMode}
                label="Advanced"
              />
            </div>
          </div>
        </div>

        {isAdvancedMode ? (
          <div
            id="advanced-mode-panel"
            className="advanced-mode-panel flex flex-1 flex-col overflow-y-auto border-b border-[#dfdfdd] bg-[#f4f4f2] md:min-h-0 md:grid md:grid-cols-[14rem_minmax(0,1fr)_23rem] md:overflow-hidden lg:grid-cols-[15rem_minmax(0,1fr)_25rem]"
          >
            <AdvancedEngineSidebar
              params={params}
              resolvedEngine={resolvedEngine}
              recipeLabel={recipeLabel}
              onChange={handleParamChange}
            />

            <div
              id="advanced-center-panel"
              className="advanced-center-panel flex min-h-[28rem] flex-1 flex-col gap-3 overflow-hidden bg-[#f4f4f2] p-4 md:min-h-0 md:min-w-0 md:p-5"
            >
              <div
                id="waveform-panel"
                className="waveform-panel relative flex h-[8.75rem] items-center justify-center overflow-hidden rounded-[1.35rem] border-4 border-[#333] bg-[#1a1a1a] shadow-inner md:h-[9.5rem] lg:h-[10.5rem]"
              >
                <WaveformVis />
              </div>

              <div
                id="advanced-envelope-section"
                className="advanced-envelope-section flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-[#dfdfdd] bg-[#fafafa] p-3.5 md:p-4"
              >
                <AdvancedEnvelopePanel
                  params={params}
                  onChange={handleParamChange}
                  onPatch={handleParamPatch}
                />
              </div>
            </div>

            <AdvancedSynthParametersPanel
              params={params}
              resolvedEngine={resolvedEngine}
              onChange={handleParamChange}
            />
          </div>
        ) : (
          <div
            id="macro-mode-panel"
            className="macro-mode-panel flex flex-1 flex-col overflow-y-auto border-b border-[#dfdfdd] bg-[#f4f4f2] md:min-h-0 md:grid md:grid-cols-[16rem_minmax(0,1fr)_28rem] md:overflow-hidden"
          >
            <div id="macro-library-panel" className="macro-library-panel flex flex-col gap-2 bg-[#f4f4f2] p-4 md:border-r md:border-[#dfdfdd] md:p-6">
              <RecipeSelector currentRecipe={recipe} onSelect={handleRecipeSelect} />
            </div>

            <div id="macro-center-panel" className="macro-center-panel flex min-h-[24rem] flex-1 flex-col p-4 md:min-h-0 md:p-6">
              <div id="prompt-generate-bar" className="prompt-generate-bar mb-6 flex gap-2">
                <input 
                  id="sound-prompt-input"
                  type="text" 
                  placeholder='e.g., "a cute snappy success"' 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  aria-label="Sound prompt"
                  className="flex-1 rounded-lg border border-[#d0d0d0] bg-white px-4 py-2 text-sm transition-all focus:border-[#111] focus:outline-none focus:ring-1 focus:ring-[#111]" 
                />
                <button 
                  id="generate-sound-button"
                  onClick={handleGenerate} 
                  aria-label="Generate sound variants from prompt"
                  className="flex items-center gap-2 rounded-lg border border-[#d0d0d0] bg-[#f0f0f0] px-4 text-sm font-medium text-[#111] transition-colors hover:bg-[#e4e4e4]"
                >
                  <Wand2 size={16} /> Generate
                </button>
              </div>

              <AnimatePresence>
                {variants.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    id="variant-selector-row"
                    className="variant-selector-row mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
                  >
                    {variants.map((v, i) => (
                      <button 
                        key={i} 
                        onClick={() => applyVariant(v)}
                        className="whitespace-nowrap bg-[#fff] border border-[#d0d0d0] text-xs px-3 py-1.5 rounded-full hover:border-[#ff4a00] hover:text-[#ff4a00] transition-colors"
                      >
                        {v.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div id="macro-waveform-panel" className="waveform-panel relative flex min-h-[200px] flex-1 items-center justify-center overflow-hidden rounded-xl border-4 border-[#333] bg-[#1a1a1a] shadow-inner">
                <WaveformVis />
              </div>
            </div>

            <div id="macro-parameter-panel" className="macro-parameter-panel bg-[#fafafa] p-4 md:min-h-0 md:overflow-y-auto md:border-l md:border-[#dfdfdd] md:p-6">
              <div className="mb-6">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">Parameters</h2>
                <p className="mt-2 text-sm text-[#666]">
                  Macro shaping stays on the front panel. Advanced mode opens the raw Tone.js synth controls.
                </p>
              </div>

              <div>
                <div className="mb-5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#a5a5a0]">Macro Controls</div>
                <ParameterGrid params={params} onChange={handleParamChange} />
              </div>
            </div>
          </div>
        )}

        <div id="app-footer" className="app-footer shrink-0 bg-[#fcfcfc]">
          <AnimatePresence initial={false}>
            {isAdvancedMode && isKeyboardVisible && (
              <motion.div
                id="musical-typing-drawer"
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="musical-typing-drawer border-t border-[#d7d6d0] bg-[rgba(250,250,248,0.98)] px-3 py-3 shadow-[0_-18px_40px_rgba(0,0,0,0.08)] backdrop-blur-md md:px-4"
              >
                <MusicalTypingKeyboard
                  activeNotes={activePerformanceNotes}
                  midiSupported={midiSupported}
                  midiEnabled={isMidiEnabled}
                  midiInputNames={midiInputNames}
                  midiError={midiError}
                  onEnableMidi={handleEnableMidi}
                  onNoteAttack={engagePerformanceNote}
                  onNoteRelease={releasePerformanceSource}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <Transport
            onPlay={handlePlay}
            onRandomize={handleRandomize}
            onExport={() => exportWav(recipe, modeScopedParams)}
            centerContent={
              <AnimatePresence initial={false}>
                {isAdvancedMode && (
                  <motion.button
                    id="musical-typing-toggle"
                    type="button"
                    initial={{ y: 18, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 18, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    aria-expanded={isKeyboardVisible}
                    aria-controls="musical-typing-drawer"
                    aria-label={isKeyboardVisible ? 'Hide musical typing keyboard' : 'Show musical typing keyboard'}
                    onClick={() => setIsKeyboardVisible((visible) => !visible)}
                    className="musical-typing-toggle inline-flex h-11 items-center gap-2 rounded-full border border-[#d7d4cb] bg-white px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5d5c57] transition-colors hover:bg-[#f5f3ed]"
                  >
                    <Keyboard size={12} />
                    <span>{isKeyboardVisible ? 'Hide Musical Typing' : 'Show Musical Typing'}</span>
                  </motion.button>
                )}
              </AnimatePresence>
            }
          />
        </div>
      </motion.div>
    </div>
  );
}
