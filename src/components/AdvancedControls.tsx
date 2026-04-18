import React, { useEffect, useMemo, useRef } from 'react';
import { Layers2 } from 'lucide-react';
import { AudioParams, FilterType, ResolvedSynthEngine, SynthOscillatorType } from '../types';
import {
  engineLabels,
  engineOptions,
  filterOptions,
  formatFrequency,
  formatSeconds,
  oscillatorOptions,
  toAttackSeconds,
  toEnvelopeDecaySeconds,
  toFilterCutoffFrequency,
  toFilterQ,
  toPitchFrequency,
  toReleaseSeconds,
  toTriggerLengthSeconds
} from '../audioConfig';
import { Knob } from './Knob';

interface SharedAdvancedControlProps {
  params: AudioParams;
  onChange: <K extends keyof AudioParams>(key: K, value: AudioParams[K]) => void;
}

interface AdvancedEnvelopePanelProps extends SharedAdvancedControlProps {
  onPatch: (patch: Partial<AudioParams>) => void;
}

interface AdvancedEngineSidebarProps extends SharedAdvancedControlProps {
  resolvedEngine: ResolvedSynthEngine;
  recipeLabel: string;
}

interface AdvancedSynthParametersPanelProps extends SharedAdvancedControlProps {
  resolvedEngine: ResolvedSynthEngine;
}

interface SelectFieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

interface KnobFieldProps {
  id: string;
  label: string;
  ariaLabel: string;
  value: number;
  displayValue: string;
  defaultValue: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'xs';
}

type AdvancedKnobParamKey = 'pitch' | 'decay' | 'brightness' | 'character' | 'filterCutoff' | 'filterQ';

type EnvelopeHandle = 'attack' | 'decay' | 'sustain' | 'release';

interface EnvelopeDragState {
  handle: EnvelopeHandle;
  startPoint: { x: number; y: number };
  startValues: Pick<AudioParams, 'attack' | 'envelopeDecay' | 'sustain' | 'release'>;
}

interface SynthParameterDefinition {
  key: AdvancedKnobParamKey;
  label: string;
  ariaLabel: string;
  defaultValue: number;
  displayValue: (params: AudioParams) => string;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const selectFieldClassName =
  'advanced-select-field flex flex-col gap-2 rounded-xl border border-[#d7d6d0] bg-white p-2.5';

const SelectField = <T extends string>({ id, label, value, options, onChange }: SelectFieldProps<T>) => (
  <label id={`${id}-field`} className={selectFieldClassName}>
    <span className="advanced-select-label text-[10px] font-bold uppercase tracking-[0.22em] text-[#888]">{label}</span>
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="advanced-select-input rounded-lg border border-[#d7d6d0] bg-[#faf9f5] px-3 py-1.5 text-[13px] text-[#111] outline-none transition-colors focus:border-[#ff4a00]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const KnobField: React.FC<KnobFieldProps> = ({
  id,
  label,
  ariaLabel,
  value,
  displayValue,
  defaultValue,
  onChange,
  size = 'sm'
}) => (
  <div id={`${id}-field`} className="advanced-knob-field rounded-xl border border-[#d7d6d0] bg-[#faf9f5] p-2.5">
    <Knob
      id={id}
      ariaLabel={ariaLabel}
      label={label}
      value={value}
      onChange={onChange}
      defaultValue={defaultValue}
      valueText={displayValue}
      size={size}
    />
  </div>
);

const envelopeLayout = {
  width: 440,
  height: 164,
  startX: 24,
  peakY: 24,
  sustainX: 310,
  baselineY: 132,
  attackStartX: 72,
  attackRange: 72,
  decayGapMin: 28,
  decayRange: 84,
  sustainTopY: 48,
  sustainHeight: 56,
  releaseStartX: 334,
  releaseRange: 74
};

const getContextualParameterDefinitions = (engine: ResolvedSynthEngine): SynthParameterDefinition[] => {
  const commonControls: SynthParameterDefinition[] = [
    {
      key: 'pitch',
      label: 'Pitch',
      ariaLabel: 'Synth pitch frequency',
      defaultValue: 0.5,
      displayValue: (params) => formatFrequency(toPitchFrequency(params.pitch))
    },
    {
      key: 'decay',
      label: 'Length',
      ariaLabel: 'Trigger length',
      defaultValue: 0.3,
      displayValue: (params) => formatSeconds(toTriggerLengthSeconds(params.decay))
    },
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
    case 'fm':
    case 'polyfm':
      return [
        ...commonControls,
        {
          key: 'brightness',
          label: 'Index',
          ariaLabel: 'FM modulation index',
          defaultValue: 0.7,
          displayValue: (params) => `${(1 + params.brightness * 14).toFixed(1)}x`
        },
        {
          key: 'character',
          label: 'Ratio',
          ariaLabel: 'FM harmonicity ratio',
          defaultValue: 0.2,
          displayValue: (params) => `${(0.5 + params.character * 4.5).toFixed(2)}x`
        }
      ];
    case 'am':
      return [
        ...commonControls,
        {
          key: 'character',
          label: 'Ratio',
          ariaLabel: 'AM harmonicity ratio',
          defaultValue: 0.2,
          displayValue: (params) => `${(0.5 + params.character * 4.5).toFixed(2)}x`
        }
      ];
    case 'membrane':
      return [
        ...commonControls,
        {
          key: 'brightness',
          label: 'Punch',
          ariaLabel: 'Membrane pitch decay',
          defaultValue: 0.7,
          displayValue: (params) => formatSeconds(0.01 + params.brightness * 0.2)
        },
        {
          key: 'character',
          label: 'Octaves',
          ariaLabel: 'Membrane sweep octaves',
          defaultValue: 0.2,
          displayValue: (params) => `${(1 + params.character * 8).toFixed(1)} oct`
        }
      ];
    case 'metal':
      return [
        ...commonControls,
        {
          key: 'brightness',
          label: 'Index',
          ariaLabel: 'Metal modulation index',
          defaultValue: 0.7,
          displayValue: (params) => `${(1 + params.brightness * 14).toFixed(1)}x`
        },
        {
          key: 'character',
          label: 'Harmonicity',
          ariaLabel: 'Metal harmonicity',
          defaultValue: 0.2,
          displayValue: (params) => `${(0.5 + params.character * 4.5).toFixed(2)}x`
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
    case 'synth':
    default:
      return commonControls;
  }
};

export const AdvancedEngineSidebar: React.FC<AdvancedEngineSidebarProps> = ({
  params,
  resolvedEngine,
  recipeLabel,
  onChange
}) => {
  return (
    <aside
      id="advanced-library-panel"
      className="advanced-library-panel flex flex-col gap-4 bg-[#f4f4f2] p-4 md:w-56 md:border-r md:border-[#dfdfdd] md:p-5 lg:w-60"
    >
      <div className="advanced-library-header">
        <h2 id="advanced-library-title" className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">
          Engine
        </h2>

      </div>

      <div id="engine-option-list" className="advanced-engine-list flex flex-col gap-2">
        {engineOptions.map((option) => {
          const isSelected = params.engine === option.value;
          return (
            <button
              key={option.value}
              id={`engine-option-${option.value}`}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Select ${option.label} engine`}
              onClick={() => onChange('engine', option.value)}
              className={`advanced-engine-option rounded-md px-3 py-1.5 text-left text-[13px] font-medium transition-colors ${
                isSelected ? 'bg-[#111] text-white' : 'text-[#555] hover:bg-[#eae8e0]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export const AdvancedEnvelopePanel: React.FC<AdvancedEnvelopePanelProps> = ({
  params,
  onChange,
  onPatch
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStateRef = useRef<EnvelopeDragState | null>(null);
  const paramsRef = useRef(params);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const points = useMemo(() => {
    const attackX = envelopeLayout.attackStartX + params.attack * envelopeLayout.attackRange;
    const sustainY = envelopeLayout.sustainTopY + (1 - params.sustain) * envelopeLayout.sustainHeight;
    const decayX = attackX + envelopeLayout.decayGapMin + params.envelopeDecay * envelopeLayout.decayRange;
    const releaseX = envelopeLayout.releaseStartX + params.release * envelopeLayout.releaseRange;

    return {
      start: { x: 20, y: envelopeLayout.baselineY },
      attack: { x: attackX, y: envelopeLayout.peakY },
      decay: { x: decayX, y: sustainY },
      sustain: { x: envelopeLayout.sustainX, y: sustainY },
      release: { x: releaseX, y: envelopeLayout.baselineY }
    };
  }, [params.attack, params.envelopeDecay, params.sustain, params.release]);

  const toSvgPoint = (event: PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;

    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * envelopeLayout.width,
      y: ((event.clientY - rect.top) / rect.height) * envelopeLayout.height
    };
  };

  const updateFromDragState = (dragState: EnvelopeDragState, point: { x: number; y: number }) => {
    const deltaX = point.x - dragState.startPoint.x;
    const deltaY = point.y - dragState.startPoint.y;

    if (dragState.handle === 'attack') {
      onChange('attack', clamp(dragState.startValues.attack + deltaX / envelopeLayout.attackRange));
      return;
    }

    if (dragState.handle === 'decay') {
      onPatch({
        envelopeDecay: clamp(dragState.startValues.envelopeDecay + deltaX / envelopeLayout.decayRange),
        sustain: clamp(dragState.startValues.sustain - deltaY / envelopeLayout.sustainHeight)
      });
      return;
    }

    if (dragState.handle === 'sustain') {
      onChange('sustain', clamp(dragState.startValues.sustain - deltaY / envelopeLayout.sustainHeight));
      return;
    }

    onChange('release', clamp(dragState.startValues.release + deltaX / envelopeLayout.releaseRange));
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const point = toSvgPoint(event);
      if (!point) return;

      event.preventDefault();
      updateFromDragState(dragState, point);
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [onChange, onPatch]);

  const areaPath = [
    `M ${points.start.x} ${points.start.y}`,
    `L ${points.attack.x} ${points.attack.y}`,
    `L ${points.decay.x} ${points.decay.y}`,
    `L ${points.sustain.x} ${points.sustain.y}`,
    `L ${points.release.x} ${points.release.y}`,
    `L ${points.start.x} ${points.release.y}`,
    'Z'
  ].join(' ');

  const linePath = [
    `M ${points.start.x} ${points.start.y}`,
    `Q ${points.attack.x - 16} ${points.start.y - 8} ${points.attack.x} ${points.attack.y}`,
    `Q ${points.decay.x - 14} ${points.decay.y} ${points.decay.x} ${points.decay.y}`,
    `L ${points.sustain.x} ${points.sustain.y}`,
    `Q ${points.release.x - 16} ${points.sustain.y + 18} ${points.release.x} ${points.release.y}`
  ].join(' ');

  const nodeConfig: Array<{ handle: EnvelopeHandle; label: string; point: { x: number; y: number }; tone: string }> = [
    { handle: 'attack', label: 'A', point: points.attack, tone: '#ff7a3d' },
    { handle: 'decay', label: 'D', point: points.decay, tone: '#ffb067' },
    { handle: 'sustain', label: 'S', point: points.sustain, tone: '#f3de9b' },
    { handle: 'release', label: 'R', point: points.release, tone: '#7ed0ff' }
  ];

  return (
    <div id="adsr-panel" className="adsr-panel flex h-full flex-col gap-3">
      <div className="adsr-panel-header flex items-center justify-between">
        <h2 id="adsr-panel-title" className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">
          Envelope
        </h2>
      </div>

      <div
        id="adsr-editor"
        className="adsr-editor rounded-[1.4rem] border border-[#253140] bg-[radial-gradient(circle_at_top,#263243,#11161d_56%,#090c11)] p-3.5 text-white shadow-[0_16px_28px_rgba(8,10,14,0.24)]"
      >
        <svg
          id="adsr-envelope-graph"
          ref={svgRef}
          viewBox={`0 0 ${envelopeLayout.width} ${envelopeLayout.height}`}
          className="h-24 w-full overflow-visible touch-none md:h-28"
        >
          <defs>
            <linearGradient id="adsrAreaFill" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff7a3d" stopOpacity="0.24" />
              <stop offset="70%" stopColor="#ffcf7c" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#7ed0ff" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="adsrLineStroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff7a3d" />
              <stop offset="55%" stopColor="#ffd583" />
              <stop offset="100%" stopColor="#7ed0ff" />
            </linearGradient>
          </defs>

          {[44, 68, 92, 116].map((y) => (
            <line key={y} x1="18" x2={envelopeLayout.width - 18} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 5" />
          ))}

          <path d={areaPath} fill="url(#adsrAreaFill)" />
          <path d={linePath} fill="none" stroke="url(#adsrLineStroke)" strokeWidth="4" strokeLinecap="round" />

          {nodeConfig.map(({ handle, label, point, tone }) => (
            <g
              key={handle}
              id={`adsr-handle-${handle}`}
              className="adsr-handle cursor-pointer"
              aria-label={`${label} envelope handle`}
              onPointerDown={(event) => {
                const svgPoint = toSvgPoint(event.nativeEvent);
                if (!svgPoint) return;

                dragStateRef.current = {
                  handle,
                  startPoint: svgPoint,
                  startValues: {
                    attack: paramsRef.current.attack,
                    envelopeDecay: paramsRef.current.envelopeDecay,
                    sustain: paramsRef.current.sustain,
                    release: paramsRef.current.release
                  }
                };
                event.preventDefault();
                (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId);
              }}
              onPointerUp={(event) => {
                dragStateRef.current = null;
                if ((event.currentTarget as SVGGElement).hasPointerCapture(event.pointerId)) {
                  (event.currentTarget as SVGGElement).releasePointerCapture(event.pointerId);
                }
              }}
            >
              <circle cx={point.x} cy={point.y} r="9" fill={tone} fillOpacity="0.18" />
              <circle cx={point.x} cy={point.y} r="5.5" fill={tone} />
              <text x={point.x} y={point.y - 14} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.7)">
                {label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div id="adsr-knob-grid" className="adsr-knob-grid grid grid-cols-2 gap-3 md:grid-cols-4">
        <KnobField
          id="attack-knob"
          ariaLabel="Envelope attack"
          label="Attack"
          value={params.attack}
          displayValue={formatSeconds(toAttackSeconds(params.attack))}
          defaultValue={0.03}
          size="xs"
          onChange={(value) => onChange('attack', value)}
        />
        <KnobField
          id="envelope-decay-knob"
          ariaLabel="Envelope decay"
          label="Decay"
          value={params.envelopeDecay}
          displayValue={formatSeconds(toEnvelopeDecaySeconds(params.envelopeDecay))}
          defaultValue={0.28}
          size="xs"
          onChange={(value) => onChange('envelopeDecay', value)}
        />
        <KnobField
          id="sustain-knob"
          ariaLabel="Envelope sustain"
          label="Sustain"
          value={params.sustain}
          displayValue={`${Math.round(params.sustain * 100)}%`}
          defaultValue={0.16}
          size="xs"
          onChange={(value) => onChange('sustain', value)}
        />
        <KnobField
          id="release-knob"
          ariaLabel="Envelope release"
          label="Release"
          value={params.release}
          displayValue={formatSeconds(toReleaseSeconds(params.release))}
          defaultValue={0.22}
          size="xs"
          onChange={(value) => onChange('release', value)}
        />
      </div>
    </div>
  );
};

export const AdvancedSynthParametersPanel: React.FC<AdvancedSynthParametersPanelProps> = ({
  params,
  resolvedEngine,
  onChange
}) => {
  const parameterDefinitions = useMemo(() => getContextualParameterDefinitions(resolvedEngine), [resolvedEngine]);
  const synthSpecificDefinitions = parameterDefinitions.filter(
    (definition) => definition.key !== 'filterCutoff' && definition.key !== 'filterQ'
  );
  const supportsSecondaryVoice =
    resolvedEngine === 'fm' || resolvedEngine === 'am' || resolvedEngine === 'polyfm' || resolvedEngine === 'duo';
  const oscillatorLabel =
    resolvedEngine === 'duo'
      ? 'Voice A'
      : resolvedEngine === 'fm' || resolvedEngine === 'am' || resolvedEngine === 'polyfm'
        ? 'Carrier'
        : 'Oscillator';
  const modulatorLabel = resolvedEngine === 'duo' ? 'Voice B' : 'Modulator';

  return (
    <aside
      id="advanced-parameter-panel"
      className="advanced-parameter-panel flex min-h-0 flex-col gap-3 overflow-y-auto bg-[#fafafa] p-4 md:w-[22rem] md:border-l md:border-[#dfdfdd] md:p-5 lg:w-[24rem]"
    >
      <div className="advanced-parameter-header flex items-center justify-between">
        <h2 id="advanced-parameter-title" className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">
          Parameters
        </h2>
        <div className="advanced-parameter-badge inline-flex items-center gap-1 rounded-full border border-[#d7d4cb] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6a6862]">
          <Layers2 size={11} />
          <span>{engineLabels[resolvedEngine]}</span>
        </div>
      </div>

      <section
        id="voice-control-panel"
        className="voice-control-panel rounded-[1.25rem] border border-[#dfdfdd] bg-white p-3"
      >
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8c8a84]">Voice</div>
        <div className="space-y-3">
          <SelectField<SynthOscillatorType>
            id="oscillator-select"
            label={oscillatorLabel}
            value={params.oscillatorType}
            options={oscillatorOptions}
            onChange={(value) => onChange('oscillatorType', value)}
          />
          {supportsSecondaryVoice && (
            <SelectField<SynthOscillatorType>
              id="modulator-select"
              label={modulatorLabel}
              value={params.modulationType}
              options={oscillatorOptions}
              onChange={(value) => onChange('modulationType', value)}
            />
          )}
        </div>
      </section>

      <section
        id="filter-control-panel"
        className="filter-control-panel rounded-[1.25rem] border border-[#dfdfdd] bg-white p-3"
      >
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8c8a84]">Filter</div>
        <div className="space-y-3">
          <SelectField<FilterType>
            id="filter-type-select"
            label="Response"
            value={params.filterType}
            options={filterOptions}
            onChange={(value) => onChange('filterType', value)}
          />
          <div id="filter-response-grid" className="filter-response-grid grid grid-cols-2 gap-3">
            <KnobField
              id="filter-cutoff-knob"
              ariaLabel="Filter cutoff frequency"
              label="Cutoff"
              value={params.filterCutoff}
              displayValue={formatFrequency(toFilterCutoffFrequency(params.filterCutoff))}
              defaultValue={0.7}
              size="xs"
              onChange={(value) => onChange('filterCutoff', value)}
            />
            <KnobField
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
      </section>

      <section
        id="engine-parameter-section"
        className="engine-parameter-section rounded-[1.25rem] border border-[#dfdfdd] bg-white p-3"
      >
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8c8a84]">
          {engineLabels[resolvedEngine]}
        </div>
        <div id="advanced-parameter-grid" className="advanced-parameter-grid grid grid-cols-2 gap-3">
          {synthSpecificDefinitions.map((definition) => (
            <KnobField
              key={`${resolvedEngine}-${definition.key}-${definition.label}`}
              id={`${definition.key}-advanced-knob`}
              ariaLabel={definition.ariaLabel}
              label={definition.label}
              value={params[definition.key]}
              displayValue={definition.displayValue(params)}
              defaultValue={definition.defaultValue}
              size="xs"
              onChange={(value) => onChange(definition.key, value)}
            />
          ))}
        </div>
      </section>
    </aside>
  );
};
