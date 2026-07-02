<script lang="ts">
  import DayDetailEditForm from './DayDetailEditForm.svelte';
  import type { TrainingTag, DailyTask, Exercise, ExerciseEntry, Split, DayEntry } from '$lib/types';

  export let dateKey: string;
  export let userId: string;
  export let activeTags: TrainingTag[];
  export let selectedIds: Set<string> = new Set();
  export let splits: Split[] = [];
  export let selectedSplitIds: Set<string> = new Set();
  export let exercises: Exercise[] = [];
  export let allDays: Record<string, DayEntry> = {};
  export let exerciseEntries: ExerciseEntry[] = [];
  export let label: string = '';
  export let activeTasks: DailyTask[] = [];
  export let completedTaskIds: Set<string> = new Set();
  export let note: string = '';
  export let noteMode: 'edit' | 'preview' = 'preview';
  export let photoPaths: string[] = [];
  export let hideOtherSectionsWhileEditingNote = true;
  export let saving: boolean = false;
  export let saved: boolean = false;
  export let hideCancel: boolean = false;

  let saveCount = 0;
  let cancelCount = 0;
</script>

<DayDetailEditForm
  {dateKey} {userId} {activeTags} bind:selectedIds {splits} bind:selectedSplitIds {exercises} {allDays}
  bind:exerciseEntries bind:label {activeTasks} bind:completedTaskIds bind:note bind:noteMode bind:photoPaths
  {hideOtherSectionsWhileEditingNote} {saving} {saved} {hideCancel}
  on:save={() => (saveCount += 1)}
  on:cancel={() => (cancelCount += 1)}
/>

<div data-testid="event-info">
  <div data-testid="save-count">{saveCount}</div>
  <div data-testid="cancel-count">{cancelCount}</div>
</div>
