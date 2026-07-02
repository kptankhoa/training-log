<script lang="ts">
  export let id: string;
  export let label: string;
  export let type: 'text' | 'date' = 'text';
  export let inputmode: 'text' | 'decimal' | 'numeric' | undefined = undefined;
  export let placeholder: string = '';
  export let value: string = '';
</script>

<label for={id} class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">{label}</label>
<input
  {id}
  {type}
  {inputmode}
  {placeholder}
  bind:value
  class="bg-gb-light-bg2 dark:bg-gb-bg2 text-gb-light-fg dark:text-gb-fg text-sm px-3 py-2 border border-gb-light-bg3 dark:border-gb-bg3 focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
/>
