<script lang="ts">
  import { onMount } from 'svelte';
  import type { AudioParams } from '../../types';
  import { formatSeconds, toAttackSeconds, toEnvelopeDecaySeconds, toReleaseSeconds } from '../../audioConfig';
  import Knob from '../Knob.svelte';

  let { params, onChange, onPatch } = $props<{
    params: AudioParams;
    onChange: <K extends keyof AudioParams>(key: K, value: AudioParams[K]) => void;
    onPatch: (patch: Partial<AudioParams>) => void;
  }>();

  let svgElement: SVGSVGElement;
  let envelopeLayout = $state({ width: 340, height: 160 });

  const nodeConfig = $derived.by(() => {
    const layout = envelopeLayout;
    const padX = 18;
    const w = layout.width - padX * 2;
    const h = layout.height - 44;
    const baseY = layout.height - 22;

    const attackX = padX + params.attack * (w * 0.25);
    const attackY = baseY - h;

    const decayX = attackX + 10 + params.envelopeDecay * (w * 0.35);
    const sustainY = baseY - params.sustain * h;

    const releaseStartX = layout.width - padX - 10 - params.release * (w * 0.3);
    const releaseEndX = releaseStartX + 10 + params.release * (w * 0.3);

    return [
      { handle: 'attack' as const, label: 'A', tone: '#ff7a3d', point: { x: attackX, y: attackY } },
      { handle: 'decay' as const, label: 'D', tone: '#ffb152', point: { x: decayX, y: sustainY } },
      { handle: 'sustain' as const, label: 'S', tone: '#7ed0ff', point: { x: releaseStartX, y: sustainY } },
      { handle: 'release' as const, label: 'R', tone: '#4da6ff', point: { x: releaseEndX, y: baseY } }
    ];
  });

  const areaPath = $derived.by(() => {
    const pX = 18;
    const bY = envelopeLayout.height - 22;
    const [a, d, s, r] = nodeConfig;
    return `M ${pX} ${bY} L ${a.point.x} ${a.point.y} L ${d.point.x} ${d.point.y} L ${s.point.x} ${s.point.y} L ${r.point.x} ${r.point.y} Z`;
  });

  const linePath = $derived.by(() => {
    const pX = 18;
    const bY = envelopeLayout.height - 22;
    const [a, d, s, r] = nodeConfig;
    return `M ${pX} ${bY} L ${a.point.x} ${a.point.y} L ${d.point.x} ${d.point.y} L ${s.point.x} ${s.point.y} L ${r.point.x} ${r.point.y}`;
  });

  let dragState = $state<{
    handle: 'attack' | 'decay' | 'sustain' | 'release';
    startPoint: { x: number; y: number };
    startValues: Pick<AudioParams, 'attack' | 'envelopeDecay' | 'sustain' | 'release'>;
  } | null>(null);

  const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  const toSvgPoint = (clientX: number, clientY: number) => {
    if (!svgElement) return null;
    const ctm = svgElement.getScreenCTM();
    if (!ctm) return null;
    const pt = svgElement.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(ctm.inverse());
  };

  const clearDragState = () => {
    dragState = null;
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!dragState) return;
    const svgPoint = toSvgPoint(event.clientX, event.clientY);
    if (!svgPoint) return;

    const dx = svgPoint.x - dragState.startPoint.x;
    const dy = svgPoint.y - dragState.startPoint.y;
    const layout = envelopeLayout;
    const w = layout.width - 36;
    const h = layout.height - 44;

    const patch: Partial<AudioParams> = {};
    if (dragState.handle === 'attack') {
      const deltaX = dx / (w * 0.25);
      patch.attack = clamp(dragState.startValues.attack + deltaX);
    } else if (dragState.handle === 'decay') {
      const deltaX = dx / (w * 0.35);
      patch.envelopeDecay = clamp(dragState.startValues.envelopeDecay + deltaX);
    } else if (dragState.handle === 'sustain') {
      const deltaY = -dy / h;
      patch.sustain = clamp(dragState.startValues.sustain + deltaY);
    } else if (dragState.handle === 'release') {
      const deltaX = dx / (w * 0.3);
      patch.release = clamp(dragState.startValues.release + deltaX);
    }

    if (Object.keys(patch).length > 0) {
      onPatch(patch);
    }
  };

  onMount(() => {
    const handleResize = () => {
      if (svgElement) {
        const rect = svgElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          envelopeLayout = { width: rect.width, height: rect.height };
        }
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={clearDragState} onpointercancel={clearDragState} />

<div id="advanced-adsr-panel" class="advanced-adsr-panel flex flex-1 flex-col gap-4 bg-[#fdfdfc] p-4 md:p-5">
  <div class="adsr-panel-header flex items-center justify-between">
    <h2 id="adsr-panel-title" class="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">
      Envelope
    </h2>
  </div>

  <div
    id="adsr-editor"
    class="adsr-editor rounded-[1.4rem] border border-[#253140] bg-[radial-gradient(circle_at_top,#263243,#11161d_56%,#090c11)] p-3.5 text-white shadow-[0_16px_28px_rgba(8,10,14,0.24)]"
  >
    <svg
      id="adsr-envelope-graph"
      bind:this={svgElement}
      viewBox={`0 0 ${envelopeLayout.width} ${envelopeLayout.height}`}
      class="h-24 w-full overflow-visible touch-none md:h-28"
    >
      <defs>
        <linearGradient id="adsrAreaFill" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ff7a3d" stop-opacity="0.24" />
          <stop offset="70%" stop-color="#ffcf7c" stop-opacity="0.14" />
          <stop offset="100%" stop-color="#7ed0ff" stop-opacity="0.1" />
        </linearGradient>
        <linearGradient id="adsrLineStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ff7a3d" />
          <stop offset="55%" stop-color="#ffd583" />
          <stop offset="100%" stop-color="#7ed0ff" />
        </linearGradient>
      </defs>

      {#each [44, 68, 92, 116] as y}
        <line x1="18" x2={envelopeLayout.width - 18} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 5" />
      {/each}

      <path d={areaPath} fill="url(#adsrAreaFill)" />
      <path d={linePath} fill="none" stroke="url(#adsrLineStroke)" stroke-width="4" stroke-linecap="round" />

      {#each nodeConfig as { handle, label, point, tone }}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <g
          id={`adsr-handle-${handle}`}
          class="adsr-handle cursor-pointer"
          role="button"
          tabindex="0"
          aria-label={`${label} envelope handle`}
          onpointerdown={(event) => {
            const svgPoint = toSvgPoint(event.clientX, event.clientY);
            if (!svgPoint) return;

            dragState = {
              handle,
              startPoint: svgPoint,
              startValues: {
                attack: params.attack,
                envelopeDecay: params.envelopeDecay,
                sustain: params.sustain,
                release: params.release
              }
            };
            event.preventDefault();
            (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId);
          }}
          onpointerup={(event) => {
            clearDragState();
            if ((event.currentTarget as SVGGElement).hasPointerCapture(event.pointerId)) {
              (event.currentTarget as SVGGElement).releasePointerCapture(event.pointerId);
            }
          }}
          onpointercancel={clearDragState}
          onlostpointercapture={clearDragState}
        >
          <circle cx={point.x} cy={point.y} r="9" fill={tone} fill-opacity="0.18" />
          <circle cx={point.x} cy={point.y} r="5.5" fill={tone} />
          <text x={point.x} y={point.y - 14} text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.7)">
            {label}
          </text>
        </g>
      {/each}
    </svg>
  </div>

  <div id="adsr-knob-grid" class="adsr-knob-grid grid grid-cols-2 gap-3 md:grid-cols-4">
    <div id="attack-knob-field" class="advanced-knob-field rounded-xl border border-[#d7d6d0] bg-[#faf9f5] p-2.5">
      <Knob
        id="attack-knob"
        ariaLabel="Envelope attack"
        label="Attack"
        value={params.attack}
        displayValue={formatSeconds(toAttackSeconds(params.attack))}
        defaultValue={0.03}
        size="xs"
        onChange={(value) => onChange('attack', value)}
      />
    </div>
    <div id="envelope-decay-knob-field" class="advanced-knob-field rounded-xl border border-[#d7d6d0] bg-[#faf9f5] p-2.5">
      <Knob
        id="envelope-decay-knob"
        ariaLabel="Envelope decay"
        label="Decay"
        value={params.envelopeDecay}
        displayValue={formatSeconds(toEnvelopeDecaySeconds(params.envelopeDecay))}
        defaultValue={0.28}
        size="xs"
        onChange={(value) => onChange('envelopeDecay', value)}
      />
    </div>
    <div id="sustain-knob-field" class="advanced-knob-field rounded-xl border border-[#d7d6d0] bg-[#faf9f5] p-2.5">
      <Knob
        id="sustain-knob"
        ariaLabel="Envelope sustain"
        label="Sustain"
        value={params.sustain}
        displayValue={`${Math.round(params.sustain * 100)}%`}
        defaultValue={0.16}
        size="xs"
        onChange={(value) => onChange('sustain', value)}
      />
    </div>
    <div id="release-knob-field" class="advanced-knob-field rounded-xl border border-[#d7d6d0] bg-[#faf9f5] p-2.5">
      <Knob
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
</div>
