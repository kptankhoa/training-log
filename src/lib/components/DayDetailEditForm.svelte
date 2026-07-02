<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import MarkdownEditor from './MarkdownEditor.svelte';
  import FormField from './FormField.svelte';
  import DayTagsField from './DayTagsField.svelte';
  import DaySplitsExercises from './DaySplitsExercises.svelte';
  import DayPhotos from './DayPhotos.svelte';
  import type { TrainingTag, DailyTask, Exercise, ExerciseEntry, Split, DayEntry } from '$lib/types';

  export let dateKey: string;
  export let userId: string;
  export let activeTags: TrainingTag[];
  export let selectedIds: Set<string>;
  export let splits: Split[];
  export let selectedSplitIds: Set<string>;
  export let exercises: Exercise[] = [];
  export let allDays: Record<string, DayEntry> = {};
  export let exerciseEntries: ExerciseEntry[];
  export let label: string;
  export let activeTasks: DailyTask[] = [];
  export let completedTaskIds: Set<string>;
  export let note: string;
  export let noteMode: 'edit' | 'preview';
  export let photoPaths: string[];
  export let hideOtherSectionsWhileEditingNote = true;
  export let saving: boolean;
  export let saved: boolean;
  export let hideCancel: boolean;

  const dispatch = createEventDispatcher<{ save: void; cancel: void }>();

  $: noteEditing = hideOtherSectionsWhileEditingNote && noteMode === 'edit';

  function toggleTask(taskId: string) {
    if (completedTaskIds.has(taskId)) completedTaskIds.delete(taskId);
    else completedTaskIds.add(taskId);
    completedTaskIds = completedTaskIds;
  }
</script>

<DayTagsField {activeTags} bind:selectedIds {userId} {noteEditing} />

<DaySplitsExercises {splits} {exercises} {allDays} {dateKey} {userId} bind:selectedSplitIds bind:exerciseEntries {noteEditing} />

<!-- Label -->
<div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-1">
  <FormField id="day-label" label="Label" placeholder="Short label shown on calendar" bind:value={label} />
</div>

<!-- Daily tasks -->
{#if activeTasks.length > 0}
  <div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-2">
    <span class="text-xs text-gb-fg3 uppercase tracking-wider">Daily tasks</span>
    <div class="flex flex-col gap-1.5">
      {#each activeTasks as task (task.id)}
        <label class="flex items-center gap-2.5 text-sm text-gb-fg cursor-pointer">
          <input
            type="checkbox"
            checked={completedTaskIds.has(task.id)}
            on:change={() => toggleTask(task.id)}
            class="w-4 h-4 accent-gb-green shrink-0"
          />
          {task.name}
        </label>
      {/each}
    </div>
  </div>
{/if}

<!-- Notes -->
<div class="flex flex-col gap-1">
  <span class="text-xs text-gb-fg3 uppercase tracking-wider">Notes</span>
  <MarkdownEditor bind:value={note} bind:mode={noteMode} placeholder="Bodyweight, PRs, observations…" rows={6} />
</div>

<DayPhotos bind:photoPaths {dateKey} {userId} {noteEditing} />

<div class="flex justify-end gap-2">
  {#if hideCancel !== true}
    <button
      type="button"
      on:click={() => dispatch('cancel')}
      disabled={saving}
      class="text-gb-fg3 text-sm hover:text-gb-fg transition px-3 py-2"
    >Cancel</button>
  {/if}

  <button
    type="button"
    on:click={() => dispatch('save')}
    disabled={saving || saved}
    class="flex-1 bg-gb-green text-gb-bg font-semibold py-2.5 rounded-md
           transition-transform hover:opacity-90 active:scale-[0.98]
           disabled:opacity-90 flex items-center justify-center gap-2"
  >
    {#if saved}
      <span>✓ Saved</span>
    {:else if saving}
      <span class="w-4 h-4 rounded-full border-2 border-gb-bg border-t-transparent animate-spin"></span>
      <span>Saving…</span>
    {:else}
      <span>Save</span>
    {/if}
  </button>
</div>
