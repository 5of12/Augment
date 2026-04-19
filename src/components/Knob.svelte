<script lang="ts">
  let {
    label,
    value,
    onChange,
    defaultValue = 0.5,
    displayValue,
    id,
    ariaLabel,
    size = 'md'
  } = $props<{
    label: string;
    value: number;
    onChange: (val: number) => void;
    defaultValue?: number;
    displayValue?: string;
    id?: string;
    ariaLabel?: string;
    size?: 'md' | 'sm' | 'xs';
  }>();

  let isDragging = $state(false);
  let startY = 0;
  let startVal = 0;

  const knobSizeClass = $derived(
    size === 'xs' ? 'h-11 w-11 sm:h-12 sm:w-12' : size === 'sm' ? 'h-14 w-14' : 'h-16 w-16'
  );
  const indicatorSizeClass = $derived(size === 'xs' ? 'top-[3px] h-1.5 w-1.5' : 'top-1 h-1.5 w-1.5');
  const labelClass = $derived(size === 'xs' ? 'text-[8px] sm:text-[9px]' : size === 'sm' ? 'text-[9px]' : 'text-[10px]');
  const valueClass = $derived(size === 'xs' ? 'text-[9px] sm:text-[10px]' : size === 'sm' ? 'text-[10px]' : 'text-[11px]');
  const bubbleOffsetClass = $derived(size === 'xs' ? 'left-[calc(100%+0.1rem)]' : 'left-[calc(100%+0.15rem)]');
  const gapClass = $derived(size === 'xs' ? 'gap-0.5' : 'gap-1');

  function handlePointerDown(e: PointerEvent) {
    isDragging = true;
    startY = e.clientY;
    startVal = value;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const deltaY = startY - e.clientY;
    const sensitivity = e.shiftKey ? 0.002 : 0.008;
    let newVal = Math.max(0, Math.min(1, startVal + deltaY * sensitivity));
    onChange(newVal);
  }

  function handlePointerUp(e: PointerEvent) {
    isDragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function handlePointerCancel() {
    isDragging = false;
  }

  function handleLostPointerCapture() {
    isDragging = false;
  }

  const rotation = $derived(-135 + value * 270);
</script>

<div
  id={id ? `${id}-container` : undefined}
  class={`knob-control flex flex-col items-center ${gapClass} touch-none`}
>
  <div class="knob-dial-wrap relative">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      {id}
      aria-label={ariaLabel ?? label}
      class={`knob-dial relative ${knobSizeClass} rounded-full bg-[#f0f0f0] border-2 border-[#d0d0d0] shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),_0_4px_8px_rgba(0,0,0,0.05)] cursor-ns-resize`}
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerCancel}
      onlostpointercapture={handleLostPointerCapture}
      ondblclick={() => onChange(defaultValue)}
      style="transform: rotate({rotation}deg)"
    >
      <div class={`knob-indicator absolute ${indicatorSizeClass} left-1/2 -translate-x-1/2 bg-[#ff4a00] rounded-full shadow-sm`} ></div>
    </div>
    {#if displayValue && isDragging}
      <div
        class={`knob-value-bubble pointer-events-none absolute top-1/2 ${bubbleOffsetClass} -translate-y-1/2 rounded-[0.85rem] bg-[rgba(17,17,17,0.94)] px-2.5 py-1 text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)] whitespace-nowrap`}
      >
        <span class={`knob-value ${valueClass} font-medium tracking-[0.01em] text-white`}>{displayValue}</span>
      </div>
    {/if}
  </div>
  <span class={`knob-label ${labelClass} font-bold uppercase tracking-widest text-[#888] select-none text-center`}>{label}</span>
</div>
