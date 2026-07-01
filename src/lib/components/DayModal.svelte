<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import TagChip from './TagChip.svelte';
  import MarkdownEditor from './MarkdownEditor.svelte';
  import { saveDay } from '$lib/stores/days';
  import { addTag } from '$lib/stores/tags';
  import type { TrainingTag, DayEntry } from '$lib/types';

  export let dateKey: string;      // YYYY-MM-DD
  export let entry: DayEntry;
  export let activeTags: TrainingTag[];
  export let userId: string;

  const dispatch = createEventDispatcher();

  let selectedIds = new Set<string>(entry.tags);
  let label = entry.label;
  let note = entry.note;
  let newTagName = '';
  let addingTag = false;

  $: [yr, mo, dy] = dateKey.split('-').map(Number);
  $: heading = new Date(yr, mo - 1, dy).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  function toggleTag(tagId: string) {
    if (selectedIds.has(tagId)) selectedIds.delete(tagId);
    else selectedIds.add(tagId);
    selectedIds = selectedIds;
  }

  async function commitNewTag() {
    if (!newTagName.trim()) { addingTag = false; return; }
    await addTag(userId, newTagName.trim());
    newTagName = '';
    addingTag = false;
  }

  async function handleSave() {
    await saveDay(userId, dateKey, { tags: [...selectedIds], label, note });
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') dispatch('close');
  }

  function autofocus(el: HTMLInputElement) {
    el.focus();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="fixed inset-0 bg-black/60 z-60 flex items-end md:items-center justify-center"
  on:click|self={() => dispatch('close')}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  tabindex="-1"
>
  <div class="bg-gb-bg1 w-full md:w-[520px] max-h-[85vh] overflow-y-auto
              rounded-t-2xl md:rounded-xl shadow-2xl p-6 pb-24 md:pb-6 flex flex-col gap-5">

    <div class="flex items-start justify-between">
      <h2 id="modal-title" class="text-gb-green font-semibold text-lg leading-tight glow-green">{heading}</h2>
      <button
        type="button"
        on:click={() => dispatch('close')}
        aria-label="Close"
        class="text-gb-fg3 hover:text-gb-fg text-2xl leading-none ml-4 shrink-0"
      >×</button>
    </div>

    <!-- Training types -->
    <div class="flex flex-col gap-2">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Training types</span>
      <div class="flex flex-wrap gap-2">
        {#each activeTags as tag (tag.id)}
          <TagChip {tag} selected={selectedIds.has(tag.id)} on:toggle={() => toggleTag(tag.id)} />
        {/each}

        {#if addingTag}
          <input
            type="text"
            bind:value={newTagName}
            placeholder="Type name…"
            on:keydown={(e) => e.key === 'Enter' && commitNewTag()}
            on:blur={commitNewTag}
            class="px-3 py-1 rounded-full border border-gb-bg3 bg-gb-bg2 text-gb-fg
                   text-sm focus:outline-none focus:border-gb-blue"
            use:autofocus
          />
        {:else}
          <button
            type="button"
            on:click={() => (addingTag = true)}
            class="px-3 py-1 rounded-full border border-gb-bg3 text-gb-fg3 text-sm
                   hover:border-gb-blue hover:text-gb-blue transition"
          >+ Add</button>
        {/if}
      </div>
    </div>

    <!-- Label -->
    <div class="flex flex-col gap-1">
      <label for="day-label" class="text-xs text-gb-fg3 uppercase tracking-wider">Label</label>
      <input
        id="day-label"
        type="text"
        bind:value={label}
        placeholder="Short label shown on calendar"
        class="w-full bg-gb-bg2 text-gb-fg text-sm rounded-md px-3 py-2
               border border-gb-bg3 focus:outline-none focus:border-gb-blue"
      />
    </div>

    <!-- Notes -->
    <div class="flex flex-col gap-1">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Notes</span>
      <MarkdownEditor bind:value={note} placeholder="Bodyweight, PRs, observations…" initialMode={note ? 'preview' : 'edit'} />
    </div>

    <button
      type="button"
      on:click={handleSave}
      class="w-full bg-gb-green text-gb-bg font-semibold py-2.5 rounded-md
             hover:opacity-90 transition"
    >
      Save
    </button>
  </div>
</div>
