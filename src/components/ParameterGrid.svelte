<script lang="ts">
  import type { AudioParams, BasicParamKey } from '../types';
  import { basicParameterKeys, basicParameterLabels } from '../audioConfig';
  import Knob from './Knob.svelte';

  let { params, onChange } = $props<{
    params: AudioParams;
    onChange: (key: BasicParamKey, val: number) => void;
  }>();
</script>

<div class="grid grid-cols-2 gap-y-12 gap-x-4">
  {#each basicParameterKeys as key}
    <Knob
      label={basicParameterLabels[key]}
      value={params[key]}
      onChange={(val) => onChange(key, val)}
    />
  {/each}
</div>
