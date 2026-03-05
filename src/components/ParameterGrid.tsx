import React from 'react';
import { AudioParams } from '../types';
import { Knob } from './Knob';

interface ParameterGridProps {
  params: AudioParams;
  onChange: (key: keyof AudioParams, val: number) => void;
}

export const ParameterGrid: React.FC<ParameterGridProps> = ({ params, onChange }) => {
  return (
    <div className="grid grid-cols-2 gap-y-12 gap-x-4">
      {(Object.keys(params) as Array<keyof AudioParams>).map((key) => (
        <Knob 
          key={key} 
          label={key} 
          value={params[key]} 
          onChange={(val) => onChange(key, val)} 
        />
      ))}
    </div>
  );
};
