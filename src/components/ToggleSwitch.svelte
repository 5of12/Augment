<script lang="ts">
  import { spring } from 'svelte/motion';

  let { checked, onChange, label } = $props<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
  }>();

  let position = spring(0, { stiffness: 0.2, damping: 0.6 });

  $effect(() => {
    position.set(checked ? 18 : 0);
  });
</script>

<button
  type="button"
  onclick={() => onChange(!checked)}
  aria-pressed={checked}
  class={`flex items-center gap-2.5 rounded-full border px-2.5 py-1.5 text-left transition-colors ${
    checked
      ? 'border-[#111] bg-[#111] text-white'
      : 'border-[#d4d4d1] bg-white text-[#444]'
  }`}
>
  <div
    class={`relative h-5.5 w-10 rounded-full transition-colors ${
      checked ? 'bg-[#ff4a00]' : 'bg-[#d8d8d4]'
    }`}
  >
    <span
      style="transform: translateX({$position}px)"
      class="absolute left-0.5 top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
    ></span>
  </div>
  <div class="flex flex-col">
    <span class="text-[10px] font-bold uppercase tracking-[0.22em]">{label}</span>
  </div>
</button>
