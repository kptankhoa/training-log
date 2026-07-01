<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import { user } from '$lib/stores/auth';
  import { notes, notesLoading, initNotes, addNote, saveNote, deleteNote } from '$lib/stores/notes';
  import { activeExercises, updateExerciseSplits, initExercises } from '$lib/stores/exercises';
  import { GRUVBOX_COLORS, COLOR_ORDER } from '$lib/gruvbox';
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
  import Spinner from '$lib/components/Spinner.svelte';
  import type { PlanNote, GruvboxColor, Exercise } from '$lib/types';

  function cycleColor() {
    if (!draft) return;
    const idx = COLOR_ORDER.indexOf(draft.color);
    draft.color = COLOR_ORDER[(idx + 1) % COLOR_ORDER.length];
  }

  $: userId = $user?.uid ?? '';

  let expandedId: string | null = null;
  let editingId: string | null = null;
  let draft: { label: string; sortOrder: number; content: string; color: GruvboxColor } | null = null;

  // "Click again to confirm" delete pattern — arms for 3s, then auto-reverts.
  let confirmingDelete = false;
  let confirmDeleteTimeout: ReturnType<typeof setTimeout> | null = null;

  function resetDeleteConfirm() {
    confirmingDelete = false;
    if (confirmDeleteTimeout) clearTimeout(confirmDeleteTimeout);
  }

  function toggle(note: PlanNote) {
    if (expandedId === note.id) {
      expandedId = null;
      editingId = null;
      draft = null;
    } else {
      expandedId = note.id;
      editingId = null;
      draft = null;
    }
    resetDeleteConfirm();
  }

  function startEdit(note: PlanNote) {
    editingId = note.id;
    draft = { label: note.label, sortOrder: note.sortOrder, content: note.content, color: note.color ?? 'blue' };
    resetDeleteConfirm();
  }

  function cancelEdit() {
    editingId = null;
    draft = null;
    resetDeleteConfirm();
  }

  async function handleSave(noteId: string) {
    if (!draft || !userId) return;
    await saveNote(userId, noteId, { label: draft.label, sortOrder: Number(draft.sortOrder), content: draft.content, color: draft.color });
    editingId = null;
    draft = null;
  }

  async function handleDelete(noteId: string) {
    if (!userId) return;
    await deleteNote(userId, noteId);
    expandedId = null;
    editingId = null;
    draft = null;
  }

  function handleDeleteClick(noteId: string) {
    if (confirmingDelete) {
      resetDeleteConfirm();
      handleDelete(noteId);
      return;
    }
    confirmingDelete = true;
    if (confirmDeleteTimeout) clearTimeout(confirmDeleteTimeout);
    confirmDeleteTimeout = setTimeout(() => { confirmingDelete = false; }, 3000);
  }

  async function handleAdd() {
    if (!userId) return;
    await addNote(userId);
  }

  function isExerciseTied(exercise: Exercise, splitId: string): boolean {
    return (exercise.splitIds ?? []).includes(splitId);
  }

  async function toggleExerciseTie(exercise: Exercise, splitId: string) {
    const current = exercise.splitIds ?? [];
    const next = isExerciseTied(exercise, splitId)
      ? current.filter((id) => id !== splitId)
      : [...current, splitId];
    await updateExerciseSplits(userId, exercise.id, next);
  }

  onMount(() => {
    const unsubUser = user.subscribe((u) => {
      if (!u) return;
      initNotes(u.uid);
      initExercises(u.uid);
    });
    return unsubUser;
  });
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
  <div class="flex items-center justify-between">
    <h1 class="text-gb-green text-2xl font-bold glow-green">Split Design</h1>
    <button
      type="button"
      on:click={handleAdd}
      class="bg-gb-blue text-gb-bg font-semibold px-4 py-2 text-sm hover:opacity-90 transition"
    >+ Add</button>
  </div>

  {#if $notesLoading}
    <Spinner />
  {:else if $notes.length === 0}
    <p class="text-gb-fg3 text-sm">No notes yet. Add one to get started.</p>
  {/if}

  <div class="flex flex-col gap-2">
    {#each $notes as note (note.id)}
      <div class="bg-gb-bg1 border border-gb-bg2">

        <!-- Header / toggle -->
        <button
          type="button"
          on:click={() => toggle(note)}
          class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gb-bg2 transition"
        >
          <span class="w-3 h-3 shrink-0" style="background-color:{GRUVBOX_COLORS[note.color ?? 'blue']}"></span>
          <span class="font-semibold text-gb-fg text-sm flex-1">{note.label || 'Untitled'}</span>
          <span class="text-gb-fg3 text-xs shrink-0">{expandedId === note.id ? '▲' : '▼'}</span>
        </button>

        {#if expandedId === note.id}
          <div class="border-t border-gb-bg2">

            {#if editingId === note.id && draft}
              <!-- Edit mode -->
              <div class="px-4 py-4 flex flex-col gap-4">
                <div class="flex gap-3 items-end">
                  <button
                    type="button"
                    on:click|stopPropagation={cycleColor}
                    style="background-color:{GRUVBOX_COLORS[draft.color]}"
                    title="Click to change color"
                    class="w-6 h-9 shrink-0 hover:opacity-80 transition-opacity"
                  ></button>
                  <div class="flex flex-col gap-1 flex-1">
                    <label for="label-{note.id}" class="text-xs text-gb-fg3 uppercase tracking-wider">Label</label>
                    <input
                      id="label-{note.id}"
                      type="text"
                      bind:value={draft.label}
                      class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3
                             focus:outline-none focus:border-gb-blue w-full"
                    />
                  </div>
                  <div class="flex flex-col gap-1 w-20">
                    <label for="order-{note.id}" class="text-xs text-gb-fg3 uppercase tracking-wider">Order</label>
                    <input
                      id="order-{note.id}"
                      type="number"
                      bind:value={draft.sortOrder}
                      class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3
                             focus:outline-none focus:border-gb-blue w-full"
                    />
                  </div>
                </div>

                <MarkdownEditor bind:value={draft.content} placeholder="Write your note…" initialMode="edit" />

                <div class="flex flex-col gap-2">
                  <span class="text-xs text-gb-fg3 uppercase tracking-wider">Exercises</span>
                  {#if $activeExercises.length === 0}
                    <p class="text-gb-fg3 text-xs italic">No exercises yet — add some in Settings.</p>
                  {:else}
                    <div class="flex flex-wrap gap-2">
                      {#each $activeExercises as exercise (exercise.id)}
                        <button
                          type="button"
                          on:click={() => toggleExerciseTie(exercise, note.id)}
                          class="px-3 py-1 text-xs border transition
                                 {isExerciseTied(exercise, note.id)
                                   ? 'border-gb-green text-gb-green bg-gb-bg2'
                                   : 'border-gb-bg3 text-gb-fg3 hover:border-gb-blue hover:text-gb-blue'}"
                        >{exercise.name}</button>
                      {/each}
                    </div>
                  {/if}
                </div>

                <div class="flex justify-between">
                  <button
                    type="button"
                    on:click={() => handleDeleteClick(note.id)}
                    class="text-sm font-medium hover:opacity-80 transition px-2 py-1
                           {confirmingDelete ? 'text-white bg-gb-red' : 'text-gb-red'}"
                  >{confirmingDelete ? 'Confirm delete?' : 'Delete'}</button>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      on:click={cancelEdit}
                      class="text-gb-fg3 text-sm hover:text-gb-fg transition px-3 py-2"
                    >Cancel</button>
                    <button
                      type="button"
                      on:click={() => handleSave(note.id)}
                      class="bg-gb-green text-gb-bg font-semibold px-5 py-2 text-sm hover:opacity-90 transition"
                    >Save</button>
                  </div>
                </div>
              </div>

            {:else}
              <!-- View mode -->
              <div class="px-4 py-4 flex flex-col gap-4">
                {#if note.content}
                  <div class="prose prose-invert max-w-none text-sm text-gb-fg
                              [&_h1]:text-gb-green [&_h2]:text-gb-green [&_h3]:text-gb-green
                              [&_strong]:text-gb-orange [&_a]:text-gb-blue">
                    {@html marked(note.content)}
                  </div>
                {:else}
                  <p class="text-gb-fg3 text-sm italic">No content yet.</p>
                {/if}
                <div class="flex justify-end">
                  <button
                    type="button"
                    on:click={() => startEdit(note)}
                    class="bg-gb-bg2 text-gb-fg text-sm px-4 py-2 hover:bg-gb-bg3 transition"
                  >Update</button>
                </div>
              </div>
            {/if}

          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
