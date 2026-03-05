import React from 'react';
import { Play, Dice5, Download } from 'lucide-react';

interface TransportProps {
  onPlay: () => void;
  onRandomize: () => void;
  onExport: () => void;
}

export const Transport: React.FC<TransportProps> = ({ onPlay, onRandomize, onExport }) => {
  return (
    <div className="p-4 px-6 flex justify-between items-center bg-[#fcfcfc]">
      <div className="flex gap-4">
        <button 
          onClick={onPlay}
          className="w-14 h-14 bg-[#ff4a00] hover:bg-[#e64200] text-white rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95"
        >
          <Play fill="currentColor" size={24} />
        </button>
        <button 
          onClick={onRandomize}
          className="h-14 px-6 bg-[#f0f0f0] border border-[#d0d0d0] text-[#333] rounded-full flex items-center gap-2 hover:bg-[#e4e4e4] font-medium text-sm transition-transform active:scale-95"
        >
          <Dice5 size={18} /> Random
        </button>
      </div>
      <button 
        onClick={onExport}
        className="h-12 px-6 bg-[#111] text-white rounded-full flex items-center gap-2 hover:bg-[#333] font-medium text-sm transition-transform active:scale-95"
      >
        <Download size={18} /> Export WAV
      </button>
    </div>
  );
};
