<script lang="ts">
  import MarkdownEditor from './MarkdownEditor.svelte';

  export let value: string = '';
</script>

<MarkdownEditor bind:value placeholder="" />

<div data-testid="value">{value}</div>
