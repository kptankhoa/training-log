<script lang="ts">
  import { marked } from 'marked';

  export let value: string = '';
  export let placeholder: string = '';

  let mode: 'edit' | 'preview' = 'edit';

  $: rendered = marked(value) as string;
</script>

<div class="flex flex-col gap-2">
  <div class="flex justify-end">
    <button
      type="button"
      on:click={() => (mode = mode === 'edit' ? 'preview' : 'edit')}
      class="text-xs text-gb-blue hover:text-gb-fg transition px-2 py-1 rounded bg-gb-bg2"
    >
      {mode === 'edit' ? 'Preview' : 'Edit'}
    </button>
  </div>

  {#if mode === 'edit'}
    <textarea
      bind:value
      {placeholder}
      rows="6"
      class="w-full bg-gb-bg2 text-gb-fg font-mono text-sm rounded-md p-3 resize-y
             border border-gb-bg3 focus:outline-none focus:border-gb-blue"
    ></textarea>
  {:else}
    <div
      class="prose prose-invert max-w-none min-h-[8rem] bg-gb-bg2 rounded-md p-3
             text-gb-fg text-sm [&_h1]:text-gb-yellow [&_h2]:text-gb-yellow
             [&_h3]:text-gb-yellow [&_strong]:text-gb-orange [&_a]:text-gb-blue"
    >
      {@html rendered}
    </div>
  {/if}
</div>
