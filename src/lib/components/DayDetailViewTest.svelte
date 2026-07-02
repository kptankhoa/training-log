<script lang="ts">
  import DayDetailView from './DayDetailView.svelte';
  import type { TrainingTag, DailyTask, Exercise, ExerciseEntry, PlanNote } from '$lib/types';

  export let activeTags: TrainingTag[];
  export let selectedIds: Set<string> = new Set();
  export let splits: PlanNote[] = [];
  export let selectedSplitIds: Set<string> = new Set();
  export let exercises: Exercise[] = [];
  export let exerciseEntries: ExerciseEntry[] = [];
  export let label: string = '';
  export let activeTasks: DailyTask[] = [];
  export let completedTaskIds: Set<string> = new Set();
  export let note: string = '';
  export let photoPaths: string[] = [];

  let editCount = 0;
  function handleEdit() {
    editCount += 1;
  }
</script>

<DayDetailView
  {activeTags} {selectedIds} {splits} {selectedSplitIds} {exercises} {exerciseEntries}
  {label} {activeTasks} {completedTaskIds} {note} {photoPaths}
  on:edit={handleEdit}
/>

<div data-testid="event-info">
  <div data-testid="edit-count">{editCount}</div>
</div>
