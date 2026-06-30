<script lang="ts">
  import DayModal from './DayModal.svelte';
  import type { TrainingTag, DayEntry } from '$lib/types';

  export let dateKey: string;
  export let entry: DayEntry;
  export let activeTags: TrainingTag[];
  export let userId: string;

  export let closeCount = 0;
  export let lastEvent: CustomEvent | null = null;

  function handleClose(e: CustomEvent) {
    closeCount += 1;
    lastEvent = e;
  }
</script>

<DayModal {dateKey} {entry} {activeTags} {userId} on:close={handleClose} />

<div data-testid="event-info">
  <div data-testid="close-count">{closeCount}</div>
</div>
