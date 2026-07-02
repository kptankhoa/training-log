<script lang="ts">
  import TagChip from './TagChip.svelte';
  import type { TrainingTag } from '$lib/types';

  export let tag: TrainingTag;
  export let selected: boolean = false;

  let lastEvent: any = null;
  let eventCount = 0;

  function handleToggle(event: CustomEvent) {
    lastEvent = event;
    eventCount += 1;
  }
</script>

<TagChip {tag} {selected} on:toggle={handleToggle} />

<div data-testid="event-info">
  <div data-testid="event-count">{eventCount}</div>
  <div data-testid="event-detail">{lastEvent?.detail || 'none'}</div>
</div>
