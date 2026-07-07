<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { gruvboxColors } from '$lib/theme';
  import type { TrainingTag } from '$lib/types';

  export let tag: TrainingTag;
  export let selected: boolean = false;

  const dispatch = createEventDispatcher<{ toggle: string }>();

  $: hex = $gruvboxColors[tag.color];
</script>

<button
  type="button"
  on:click={() => dispatch('toggle', tag.id)}
  style="background-color: {selected ? hex : 'transparent'}; border-color: {hex}; color: {selected ? '#282828' : hex};"
  class="px-3 py-1 rounded-full border text-sm font-medium transition-colors cursor-pointer"
>
  {tag.name}
</button>
