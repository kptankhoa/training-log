<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { marked } from 'marked';
  import DayTagsField from './DayTagsField.svelte';
  import DaySplitsExercises from './DaySplitsExercises.svelte';
  import DayPhotos from './DayPhotos.svelte';
  import { icons } from '$lib/icons';
  import type { TrainingTag, DailyTask, Exercise, ExerciseEntry, PlanNote } from '$lib/types';

  export let activeTags: TrainingTag[];
  export let selectedIds: Set<string>;
  export let splits: PlanNote[];
  export let selectedSplitIds: Set<string>;
  export let exercises: Exercise[] = [];
  export let exerciseEntries: ExerciseEntry[];
  export let label: string;
  export let activeTasks: DailyTask[] = [];
  export let completedTaskIds: Set<string>;
  export let note: string;
  export let photoPaths: string[];

  const dispatch = createEventDispatcher<{ edit: void }>();
</script>

<div class="flex flex-col gap-4">
  <DayTagsField {activeTags} {selectedIds} readonly={true} />

  <DaySplitsExercises {splits} {exercises} {selectedSplitIds} {exerciseEntries} readonly={true} />

  {#if label}
    <div class="flex flex-col gap-1">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Label</span>
      <p class="text-sm text-gb-fg">{label}</p>
    </div>
  {/if}

  {#if activeTasks.length > 0}
    <div class="flex flex-col gap-1.5">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Daily tasks</span>
      <div class="flex flex-col gap-1">
        {#each activeTasks as task (task.id)}
          <span class="text-sm flex items-center gap-2 {completedTaskIds.has(task.id) ? 'text-gb-fg' : 'text-gb-fg3'}">
            <span>{completedTaskIds.has(task.id) ? '✓' : '○'}</span>
            {task.name}
          </span>
        {/each}
      </div>
    </div>
  {/if}

  <div class="flex flex-col gap-1">
    <span class="text-xs text-gb-fg3 uppercase tracking-wider">Notes</span>
    {#if note}
      <div class="prose prose-invert max-w-none text-sm text-gb-fg
                  [&_h1]:text-gb-green [&_h2]:text-gb-green [&_h3]:text-gb-green
                  [&_strong]:text-gb-orange [&_a]:text-gb-blue">
        {@html marked(note)}
      </div>
    {:else}
      <p class="text-gb-fg3 text-sm italic">No notes yet.</p>
    {/if}
  </div>

  <DayPhotos {photoPaths} readonly={true} />

  <button
    type="button"
    on:click={() => dispatch('edit')}
    class="self-end flex items-center gap-1.5 bg-gb-blue text-gb-bg font-semibold text-sm px-4 py-2 hover:opacity-90 transition"
  >{@html icons.pencilSm}Edit</button>
</div>
