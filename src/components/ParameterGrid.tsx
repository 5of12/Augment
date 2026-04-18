import React from 'react';
import { AudioParams, BasicParamKey } from '../types';
import { basicParameterKeys, basicParameterLabels } from '../audioConfig';
import { Knob } from './Knob';

interface ParameterGridProps {
  params: AudioParams;
  onChange: (key: BasicParamKey, val: number) => void;
}

export const ParameterGrid: React.FC<ParameterGridProps> = ({ params, onChange }) => {
  return (
    <div className="grid grid-cols-2 gap-y-12 gap-x-4">
      {basicParameterKeys.map((key) => (
        <Knob 
          key={key} 
          label={basicParameterLabels[key]} 
          value={params[key]} 
          onChange={(val) => onChange(key, val)} 
        />
      ))}
    </div>
  );
};
