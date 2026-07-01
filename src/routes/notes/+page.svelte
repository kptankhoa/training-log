<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import { user } from '$lib/stores/auth';
  import { notes, initNotes, addNote, saveNote, deleteNote } from '$lib/stores/notes';
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
  import type { PlanNote } from '$lib/types';

  $: userId = $user?.uid ?? '';

  let expandedId: string | null = null;
  let editingId: string | null = null;
  let draft: { label: string; sortOrder: number; content: string } | null = null;

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
  }

  function startEdit(note: PlanNote) {
    editingId = note.id;
    draft = { label: note.label, sortOrder: note.sortOrder, content: note.content };
  }

  function cancelEdit() {
    editingId = null;
    draft = null;
  }

  async function handleSave(noteId: string) {
    if (!draft || !userId) return;
    await saveNote(userId, noteId, { label: draft.label, sortOrder: Number(draft.sortOrder), content: draft.content });
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

        <!-- Header / toggle -->
        <button
          type="button"
          on:click={() => toggle(note)}
          class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gb-bg2 transition"
        >
          <span class="font-semibold text-gb-fg text-sm">{note.label || 'Untitled'}</span>
          <span class="text-gb-fg3 text-xs ml-4 shrink-0">{expandedId === note.id ? '▲' : '▼'}</span>
        </button>

        {#if expandedId === note.id}
          <div class="border-t border-gb-bg2">

            {#if editingId === note.id && draft}
              <!-- Edit mode -->
              <div class="px-4 py-4 flex flex-col gap-4">
                <div class="flex gap-3">
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

                <div class="flex justify-between">
                  <button
                    type="button"
                    on:click={() => handleDelete(note.id)}
                    class="text-gb-red text-sm hover:opacity-80 transition px-2 py-1"
                  >Delete</button>
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
