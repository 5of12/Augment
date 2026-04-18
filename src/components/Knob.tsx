import React, { useState, useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  defaultValue?: number;
  valueText?: string;
  id?: string;
  ariaLabel?: string;
  size?: 'md' | 'sm' | 'xs';
}

export const Knob: React.FC<KnobProps> = ({
  label,
  value,
  onChange,
  defaultValue = 0.5,
  valueText,
  id,
  ariaLabel,
  size = 'md'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const knobSizeClass =
    size === 'xs' ? 'h-11 w-11 sm:h-12 sm:w-12' : size === 'sm' ? 'h-14 w-14' : 'h-16 w-16';
  const indicatorSizeClass = size === 'xs' ? 'top-[3px] h-1.5 w-1.5' : 'top-1 h-1.5 w-1.5';
  const labelClass = size === 'xs' ? 'text-[8px] sm:text-[9px]' : size === 'sm' ? 'text-[9px]' : 'text-[10px]';
  const valueClass = size === 'xs' ? 'text-[9px] sm:text-[10px]' : size === 'sm' ? 'text-[10px]' : 'text-[11px]';
  const bubbleOffsetClass = size === 'xs' ? 'left-[calc(100%+0.1rem)]' : 'left-[calc(100%+0.15rem)]';
  const gapClass = size === 'xs' ? 'gap-0.5' : 'gap-1';

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
    <div
      id={id ? `${id}-container` : undefined}
      className={`knob-control flex flex-col items-center ${gapClass} touch-none`}
    >
      <div className="knob-dial-wrap relative">
        <div
          id={id}
          aria-label={ariaLabel ?? label}
          className={`knob-dial relative ${knobSizeClass} rounded-full bg-[#f0f0f0] border-2 border-[#d0d0d0] shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),_0_4px_8px_rgba(0,0,0,0.05)] cursor-ns-resize`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setIsDragging(false)}
          onLostPointerCapture={() => setIsDragging(false)}
          onDoubleClick={() => onChange(defaultValue)}
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className={`knob-indicator absolute ${indicatorSizeClass} left-1/2 -translate-x-1/2 bg-[#ff4a00] rounded-full shadow-sm`} />
        </div>
        {valueText && isDragging && (
          <div
            className={`knob-value-bubble pointer-events-none absolute top-1/2 ${bubbleOffsetClass} -translate-y-1/2 rounded-[0.85rem] bg-[rgba(17,17,17,0.94)] px-2.5 py-1 text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)] whitespace-nowrap`}
          >
            <span className={`knob-value ${valueClass} font-medium tracking-[0.01em] text-white`}>{valueText}</span>
          </div>
        )}
      </div>
      <span className={`knob-label ${labelClass} font-bold uppercase tracking-widest text-[#888] select-none text-center`}>{label}</span>
    </div>
  );
};
