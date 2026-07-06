<svelte:options accessors={true} />

<script lang="ts">
  import ExerciseEditor from './ExerciseEditor.svelte';
  import type { Exercise, ExerciseEntry, DayEntry } from '$lib/types';

  export let exercises: Exercise[] = [];
  export let allDays: Record<string, DayEntry> = {};
  export let dateKey: string;
  export let userId: string;
  export let entries: ExerciseEntry[] = [];
  export let daySplitIds: string[] = [];
</script>

<ExerciseEditor {exercises} {allDays} {dateKey} {userId} bind:entries {daySplitIds} />
