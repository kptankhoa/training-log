<script lang="ts">
  import { marked } from 'marked';

  export let value: string = '';
  export let placeholder: string = '';
  export let initialMode: 'edit' | 'preview' = 'edit';
  export let label: string = '';
  export let rows: number = 24;
  export let mode: 'edit' | 'preview' = initialMode;

  $: rendered = marked(value) as string;

  function scrollIntoViewOnFocus(el: HTMLTextAreaElement) {
    setTimeout(() => el.scrollIntoView({ block: 'center' }), 300);
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center justify-between">
    {#if label}
      <span class="text-gb-fg3 text-xs uppercase tracking-wider">{label}</span>
    {:else}
      <span></span>
    {/if}
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
      {rows}
      on:focus={(e) => scrollIntoViewOnFocus(e.currentTarget)}
      class="w-full bg-gb-bg2 text-gb-fg font-mono text-sm rounded-md p-3 resize-y
             border border-gb-bg3 focus:outline-none focus:border-gb-blue [caret-shape:block]"
    ></textarea>
  {:else}
    <div
      class="prose prose-invert max-w-none bg-gb-bg2 rounded-md p-3
             text-gb-fg text-sm [&_h1]:text-gb-green [&_h2]:text-gb-green
             [&_h3]:text-gb-green [&_strong]:text-gb-orange [&_a]:text-gb-blue"
      style="min-height: {rows * 1.5}rem"
    >
      {#if value}
        {@html rendered}
      {:else}
        <span class="text-gb-fg3">{placeholder}</span>
      {/if}
    </div>
  {/if}
</div>
