<script lang="ts">
  import { onMount } from 'svelte';
  import { user } from '$lib/stores/auth';
  import { notes, initNotes, addNote, saveNote, deleteNote } from '$lib/stores/notes';
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
  import type { PlanNote } from '$lib/types';

  $: userId = $user?.uid ?? '';

  let expandedId: string | null = null;
  let drafts: Record<string, { label: string; sortOrder: number; content: string }> = {};

  function toggle(note: PlanNote) {
    if (expandedId === note.id) {
      expandedId = null;
    } else {
      expandedId = note.id;
      if (!drafts[note.id]) {
        drafts[note.id] = { label: note.label, sortOrder: note.sortOrder, content: note.content };
      }
    }
  }

  async function handleSave(noteId: string) {
    const d = drafts[noteId];
    if (!d || !userId) return;
    await saveNote(userId, noteId, { label: d.label, sortOrder: Number(d.sortOrder), content: d.content });
    expandedId = null;
  }

  async function handleDelete(noteId: string) {
    if (!userId) return;
    await deleteNote(userId, noteId);
    expandedId = null;
    delete drafts[noteId];
    drafts = drafts;
  }

  async function handleAdd() {
    if (!userId) return;
    await addNote(userId);
  }

  onMount(() => {
    const unsubUser = user.subscribe((u) => {
      if (!u) return;
      initNotes(u.uid);
    });
    return unsubUser;
  });
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
  <div class="flex items-center justify-between">
    <h1 class="text-gb-green text-2xl font-bold glow-green">Notes</h1>
    <button
      type="button"
      on:click={handleAdd}
      class="bg-gb-blue text-gb-bg font-semibold px-4 py-2 text-sm hover:opacity-90 transition"
    >+ Add</button>
  </div>

  {#if $notes.length === 0}
    <p class="text-gb-fg3 text-sm">No notes yet. Add one to get started.</p>
  {/if}

  <div class="flex flex-col gap-2">
    {#each $notes as note (note.id)}
      <div class="bg-gb-bg1 border border-gb-bg2">

        <!-- Header / toggle row -->
        <button
          type="button"
          on:click={() => toggle(note)}
          class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gb-bg2 transition"
        >
          <span class="font-semibold text-gb-fg text-sm">{note.label || 'Untitled'}</span>
          <span class="text-gb-fg3 text-xs ml-4 shrink-0">{expandedId === note.id ? '▲' : '▼'}</span>
        </button>

        <!-- Expanded content -->
        {#if expandedId === note.id && drafts[note.id]}
          <div class="px-4 pb-4 flex flex-col gap-4 border-t border-gb-bg2">

            <div class="flex gap-3 pt-4">
              <div class="flex flex-col gap-1 flex-1">
                <label for="label-{note.id}" class="text-xs text-gb-fg3 uppercase tracking-wider">Label</label>
                <input
                  id="label-{note.id}"
                  type="text"
                  bind:value={drafts[note.id].label}
                  class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3
                         focus:outline-none focus:border-gb-blue w-full"
                />
              </div>
              <div class="flex flex-col gap-1 w-20">
                <label for="order-{note.id}" class="text-xs text-gb-fg3 uppercase tracking-wider">Order</label>
                <input
                  id="order-{note.id}"
                  type="number"
                  bind:value={drafts[note.id].sortOrder}
                  class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3
                         focus:outline-none focus:border-gb-blue w-full"
                />
              </div>
            </div>

            <MarkdownEditor bind:value={drafts[note.id].content} placeholder="Write your note…" initialMode="edit" />

            <div class="flex justify-between">
              <button
                type="button"
                on:click={() => handleDelete(note.id)}
                class="text-gb-red text-sm hover:opacity-80 transition px-2 py-1"
              >Delete</button>
              <button
                type="button"
                on:click={() => handleSave(note.id)}
                class="bg-gb-green text-gb-bg font-semibold px-5 py-2 text-sm hover:opacity-90 transition"
              >Save</button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
