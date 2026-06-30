<script lang="ts">
  import { onMount } from 'svelte';
  import { user } from '$lib/stores/auth';
  import { activeTags, addTag, deleteTag, updateTagColor, initTags } from '$lib/stores/tags';
  import { globalNote, initNote, saveNote } from '$lib/stores/note';
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
  import { GRUVBOX_COLORS, COLOR_ORDER } from '$lib/gruvbox';
  import type { GruvboxColor } from '$lib/types';

  $: userId = $user?.uid ?? '';

  let unsubTags: (() => void) | null = null;
  let unsubNote: (() => void) | null = null;

  onMount(() => {
    const unsubUser = user.subscribe((u) => {
      if (!u) return;
      unsubTags?.(); unsubTags = initTags(u.uid);
      unsubNote?.(); unsubNote = initNote(u.uid);
    });
    return () => {
      unsubUser();
      unsubTags?.();
      unsubNote?.();
    };
  });

  let newTagName = '';

  async function handleAdd() {
    if (!newTagName.trim()) return;
    await addTag(userId, newTagName.trim());
    newTagName = '';
  }

  function cycleColor(tagId: string, current: GruvboxColor) {
    const next = COLOR_ORDER[(COLOR_ORDER.indexOf(current) + 1) % COLOR_ORDER.length];
    updateTagColor(userId, tagId, next);
  }

  let noteSaveTimer: ReturnType<typeof setTimeout>;
  function scheduleNoteSave() {
    clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(() => { if (userId) saveNote(userId, $globalNote); }, 800);
  }
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-10">
  <h1 class="text-gb-green text-2xl font-bold glow-green">Settings</h1>

  <!-- Training types -->
  <section class="flex flex-col gap-4">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2">Training Types</h2>

    <ul class="flex flex-col gap-2">
      {#each $activeTags as tag (tag.id)}
        <li class="flex items-center gap-3 bg-gb-bg1 rounded-lg px-4 py-3">
          <button
            type="button"
            on:click={() => cycleColor(tag.id, tag.color)}
            style="background-color: {GRUVBOX_COLORS[tag.color]}"
            class="w-5 h-5 rounded-full shrink-0 border-2 border-gb-bg3 hover:scale-110 transition-transform"
            title="Click to change color"
          ></button>
          <span class="flex-1 text-gb-fg text-sm">{tag.name}</span>
          <button
            type="button"
            on:click={() => deleteTag(userId, tag.id)}
            aria-label="Delete {tag.name}"
            class="text-gb-fg3 hover:text-gb-red transition-colors text-sm"
          >✕</button>
        </li>
      {/each}
    </ul>

    <div class="flex gap-2">
      <input
        type="text"
        bind:value={newTagName}
        placeholder="New training type"
        on:keydown={(e) => e.key === 'Enter' && handleAdd()}
        class="flex-1 bg-gb-bg1 text-gb-fg text-sm rounded-md px-3 py-2
               border border-gb-bg2 focus:outline-none focus:border-gb-blue"
      />
      <button
        type="button"
        on:click={handleAdd}
        class="bg-gb-blue text-gb-bg font-semibold px-4 py-2 rounded-md hover:opacity-90 transition text-sm"
      >Add</button>
    </div>
  </section>

  <!-- Global notepad -->
  <section class="flex flex-col gap-4">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2">Global Notepad</h2>
    <p class="text-gb-fg3 text-xs">Visible on the calendar page. Auto-saves on change.</p>
    <div on:focusout={scheduleNoteSave}>
      <MarkdownEditor
        bind:value={$globalNote}
        placeholder="Training schedule, weekly goals, quotes…"
        initialMode="preview"
      />
    </div>
  </section>
</div>
