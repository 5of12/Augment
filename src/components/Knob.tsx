import React, { useState, useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
}

export const Knob: React.FC<KnobProps> = ({ label, value, onChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = startY.current - e.clientY;
    const sensitivity = e.shiftKey ? 0.002 : 0.008; 
    let newVal = Math.max(0, Math.min(1, startVal.current + deltaY * sensitivity));
    onChange(newVal);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const rotation = -135 + value * 270;

  return (
    <div className="flex flex-col items-center gap-3 touch-none">
      <div 
        className="relative w-16 h-16 rounded-full bg-[#f0f0f0] border-2 border-[#d0d0d0] shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),_0_4px_8px_rgba(0,0,0,0.05)] cursor-ns-resize"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={() => onChange(0.5)}
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#ff4a00] rounded-full shadow-sm" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#888] select-none">{label}</span>
    </div>
  );
};
