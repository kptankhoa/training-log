<script lang="ts">
  import DayDetail from './DayDetail.svelte';
  import type { TrainingTag, DailyTask, DayEntry } from '$lib/types';

  export let dateKey: string;
  export let entry: DayEntry;
  export let activeTags: TrainingTag[];
  export let activeTasks: DailyTask[] = [];
  export let userId: string;

  let savedCount = 0;

  function handleSaved() {
    savedCount += 1;
  }
</script>

<DayDetail {dateKey} {entry} {activeTags} {activeTasks} {userId} on:saved={handleSaved} />

<div data-testid="event-info">
  <div data-testid="saved-count">{savedCount}</div>
</div>
