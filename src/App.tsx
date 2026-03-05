import { useState, useEffect } from 'react';
import * as Tone from 'tone';
import { Wand2, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RecipeType, AudioParams, Variant } from './types';
import { playSound, updateActiveParams, getEngineTypeForRecipe } from './services/audioEngine';
import { exportWav } from './services/wavExporter';
import { generateVariantsFromPrompt } from './services/nlpEngine';
import { WaveformVis } from './components/WaveformVis';
import { RecipeSelector } from './components/RecipeSelector';
import { ParameterGrid } from './components/ParameterGrid';
import { Transport } from './components/Transport';

const defaultParams: AudioParams = { pitch: 0.5, decay: 0.3, brightness: 0.7, character: 0.2 };

export default function App() {
  const [recipe, setRecipe] = useState<RecipeType>('bloop');
  const [params, setParams] = useState<AudioParams>(defaultParams);
  const [prompt, setPrompt] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isAudioStarted, setIsAudioStarted] = useState(false);

  useEffect(() => {
    const checkState = () => {
      setIsAudioStarted(Tone.getContext().state === 'running');
    };
    const interval = setInterval(checkState, 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePlay = async () => {
    await Tone.start();
    setIsAudioStarted(true);
    playSound(recipe, params);
  };

  const handleRecipeSelect = async (newRecipe: RecipeType) => {
    await Tone.start();
    setIsAudioStarted(true);
    setRecipe(newRecipe);
    playSound(newRecipe, params);
  };

  const handleParamChange = (key: keyof AudioParams, val: number) => {
    const newParams = { ...params, [key]: val };
    setParams(newParams);
    updateActiveParams(newParams);
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    const newVariants = generateVariantsFromPrompt(prompt, recipe);
    setVariants(newVariants);
  };

  const applyVariant = (v: Variant) => {
    setRecipe(v.recipe);
    setParams(v.params);
    playSound(v.recipe, v.params);
  };

  const handleRandomize = () => {
    const randomParams: AudioParams = {
      pitch: Math.random(),
      decay: Math.random(),
      brightness: Math.random(),
      character: Math.random()
    };
    setParams(randomParams);
    playSound(recipe, randomParams);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlay();
      }
      if (e.key === 'r') handleRandomize();
      if (e.key === 'e') exportWav(recipe, params);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recipe, params]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#fcfcfc] w-full max-w-5xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.08),_inset_0_1px_1px_rgba(255,255,255,1)] border border-[#dfdfdd] flex flex-col overflow-hidden"
      >
        {/* Integrated Header */}
        <div className="p-4 border-b border-[#dfdfdd] bg-[#fcfcfc] flex justify-between items-center px-8">
          <div className="w-48 hidden md:block"></div> {/* Spacer for centering */}
          <h1 className="text-2xl font-bold tracking-tighter text-[#111] text-center flex-1">AUGMENT</h1>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#aaa] w-48 justify-end">
            <Activity size={12} className={isAudioStarted ? "text-[#ff4a00]" : "text-[#ccc]"} />
            <span>Engine: {isAudioStarted ? getEngineTypeForRecipe(recipe) : "Idle"}</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row bg-[#f4f4f2] border-b border-[#dfdfdd]">
          
          {/* Left: Recipe Selector */}
          <div className="md:w-64 p-6 border-r border-[#dfdfdd] flex flex-col gap-2">
            <RecipeSelector currentRecipe={recipe} onSelect={handleRecipeSelect} />
          </div>

          {/* Center: Vis & Prompt */}
          <div className="flex-1 p-6 flex flex-col">
            <div className="flex gap-2 mb-6">
              <input 
                type="text" 
                placeholder='e.g., "a cute snappy success"' 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                className="flex-1 bg-white border border-[#d0d0d0] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-all" 
              />
              <button 
                onClick={handleGenerate} 
                className="bg-[#f0f0f0] border border-[#d0d0d0] text-[#111] px-4 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-[#e4e4e4] transition-colors"
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
                  className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide"
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

            <div className="flex-1 bg-[#1a1a1a] rounded-xl flex items-center justify-center border-4 border-[#333] shadow-inner relative overflow-hidden min-h-[200px]">
              <span className="absolute top-3 left-4 text-[#555] text-[10px] font-bold tracking-widest z-10">WAVEFORM</span>
              <WaveformVis />
            </div>
          </div>

          {/* Right: Parameters */}
          <div className="md:w-80 p-6 border-l border-[#dfdfdd] bg-[#fafafa]">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-8">Parameters</h2>
            <ParameterGrid params={params} onChange={handleParamChange} />
          </div>
        </div>

        {/* Transport */}
        <Transport 
          onPlay={handlePlay} 
          onRandomize={handleRandomize} 
          onExport={() => exportWav(recipe, params)} 
        />
      </motion.div>
    </div>
  );
}
