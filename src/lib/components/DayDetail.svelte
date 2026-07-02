<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import DayDetailView from './DayDetailView.svelte';
  import DayDetailEditForm from './DayDetailEditForm.svelte';
  import { saveDay } from '$lib/stores/days';
  import { deletePhoto } from '$lib/stores/photos';
  import type { TrainingTag, DailyTask, Exercise, ExerciseEntry, Split, DayEntry } from '$lib/types';

  export let dateKey: string;      // YYYY-MM-DD
  export let entry: DayEntry;
  export let activeTags: TrainingTag[];
  export let activeTasks: DailyTask[] = [];
  export let exercises: Exercise[] = []; // full list (incl. deleted) so old logs still resolve names
  export let splits: Split[] = [];
  export let allDays: Record<string, DayEntry> = {};
  export let userId: string;
  // Only useful in a height-constrained modal sheet — the inline Home page
  // has no such constraint, so it opts out.
  export let hideOtherSectionsWhileEditingNote = true;
  export let editOnly = false; // for DayModal, which has its own Save/Cancel buttons

  const dispatch = createEventDispatcher<{ saved: void }>();

  let selectedIds = new Set<string>(entry.tags);
  let selectedSplitIds = new Set<string>(entry.splitIds ?? []);
  let completedTaskIds = new Set<string>(entry.tasks ?? []);
  let label = entry.label;
  let note = entry.note;
  let noteMode: 'edit' | 'preview' = editOnly || note ? 'preview' : 'edit';
  let saving = false;
  let saved = false;
  let savedResetTimeout: ReturnType<typeof setTimeout> | null = null;

  function cloneExerciseEntries(list: ExerciseEntry[] | undefined): ExerciseEntry[] {
    return (list ?? []).map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map((s) => ({ ...s })) }));
  }

  let exerciseEntries: ExerciseEntry[] = cloneExerciseEntries(entry.exercises);

  // Photos: uploads commit to Storage immediately (need a real ref to preview),
  // but removals only take effect on Save, so discarding edits still works.
  const originalPhotoPaths = entry.photos ?? [];
  let photoPaths = [...originalPhotoPaths];

  function hasAnyContent(): boolean {
    return selectedIds.size > 0 || selectedSplitIds.size > 0 || !!label.trim() || !!note.trim()
      || completedTaskIds.size > 0 || photoPaths.length > 0 || exerciseEntries.length > 0;
  }

  // View mode by default for a day that already has something logged —
  // jumping straight into an editable form every time feels heavy-handed.
  let mode: 'view' | 'edit' = (editOnly || !hasAnyContent()) ? 'edit' : 'view';

  onDestroy(() => {
    if (savedResetTimeout) clearTimeout(savedResetTimeout);
  });

  function startEdit() {
    mode = 'edit';
    if (!editOnly) {
    noteMode = 'edit';
    }
  }

  function cancelEdit() {
    selectedIds = new Set(entry.tags);
    selectedSplitIds = new Set(entry.splitIds ?? []);
    completedTaskIds = new Set(entry.tasks ?? []);
    label = entry.label;
    note = entry.note;
    noteMode = note ? 'preview' : 'edit';
    photoPaths = [...originalPhotoPaths];
    exerciseEntries = cloneExerciseEntries(entry.exercises);
    mode = hasAnyContent() ? 'view' : 'edit';
  }

  async function handleSave() {
    if (saving || saved) return;
    saving = true;
    try {
      const removedPaths = originalPhotoPaths.filter((p) => !photoPaths.includes(p));
      await saveDay(userId, dateKey, {
        tags: [...selectedIds], label, note, tasks: [...completedTaskIds], photos: photoPaths,
        exercises: exerciseEntries, splitIds: [...selectedSplitIds]
      });
      await Promise.all(
        removedPaths.map((p) => deletePhoto(p).catch((err) => console.error('[DayDetail] failed to delete photo:', err)))
      );
      saving = false;
      saved = true;
      dispatch('saved');
      if (savedResetTimeout) clearTimeout(savedResetTimeout);
      savedResetTimeout = setTimeout(() => {
        saved = false;
        if (!editOnly) {
          mode = 'view';
        }
      }, 1500);
    } catch (err) {
      saving = false;
      console.error('[DayDetail] save failed:', err);
    }
  }
</script>

{#if mode === 'view'}
  <DayDetailView
    {activeTags} {selectedIds} {splits} {selectedSplitIds} {exercises} {exerciseEntries}
    {label} {activeTasks} {completedTaskIds} {note} {photoPaths}
    on:edit={startEdit}
  />
{:else}
  <DayDetailEditForm
    {dateKey} {userId} {activeTags} bind:selectedIds {splits} bind:selectedSplitIds {exercises} {allDays}
    bind:exerciseEntries bind:label {activeTasks} bind:completedTaskIds bind:note bind:noteMode bind:photoPaths
    {hideOtherSectionsWhileEditingNote} {saving} {saved}
    on:save={handleSave} on:cancel={cancelEdit}
  />
{/if}
