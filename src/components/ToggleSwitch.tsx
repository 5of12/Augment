import React from 'react';
import { motion } from 'motion/react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, description }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`flex items-center gap-2.5 rounded-full border px-2.5 py-1.5 text-left transition-colors ${
        checked
          ? 'border-[#111] bg-[#111] text-white'
          : 'border-[#d4d4d1] bg-white text-[#444]'
      }`}
    >
      <div
        className={`relative h-5.5 w-10 rounded-full transition-colors ${
          checked ? 'bg-[#ff4a00]' : 'bg-[#d8d8d4]'
        }`}
      >
        <motion.span
          animate={{ x: checked ? 18 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="absolute left-0.5 top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
        />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em]">{label}</span>
      </div>
    </button>
  );
};
