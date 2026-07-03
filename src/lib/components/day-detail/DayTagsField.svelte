<script lang="ts">
  import TagChip from './TagChip.svelte';
  import { addTag } from '$lib/stores/tags';
  import { gruvboxColors } from '$lib/gruvbox';
  import { showError } from '$lib/stores/toast';
  import type { TrainingTag } from '$lib/types';

  export let activeTags: TrainingTag[];
  export let selectedIds: Set<string>;
  export let userId: string = '';
  export let readonly: boolean = false;
  export let noteEditing: boolean = false;

  $: selectedTagList = activeTags.filter((t) => selectedIds.has(t.id));

  let newTagName = '';
  let addingTag = false;

  function toggleTag(tagId: string) {
    if (selectedIds.has(tagId)) selectedIds.delete(tagId);
    else selectedIds.add(tagId);
    selectedIds = selectedIds;
  }

  async function commitNewTag() {
    if (!newTagName.trim()) { addingTag = false; return; }
    try {
      await addTag(userId, newTagName.trim());
      newTagName = '';
      addingTag = false;
    } catch {
      showError();
    }
  }

  function autofocus(el: HTMLInputElement) {
    el.focus();
  }
</script>

{#if readonly}
  <div class="flex flex-col gap-1.5">
    <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Training types</span>
    {#if selectedTagList.length > 0}
      <div class="flex flex-wrap gap-3">
        {#each selectedTagList as tag (tag.id)}
          <span class="flex items-center gap-1.5 text-sm text-gb-light-fg dark:text-gb-fg">
            <span class="w-2.5 h-2.5 shrink-0" style="background-color:{$gruvboxColors[tag.color]}"></span>
            {tag.name}
          </span>
        {/each}
      </div>
    {:else}
      <p class="text-gb-light-fg3 dark:text-gb-fg3 text-sm italic">Nothing logged yet.</p>
    {/if}
  </div>
{:else}
  <div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-2">
    <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Training types</span>
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
          class="px-3 py-1 rounded-full border border-gb-light-bg3 dark:border-gb-bg3 bg-gb-light-bg2 dark:bg-gb-bg2 text-gb-light-fg dark:text-gb-fg
                 text-sm focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
          use:autofocus
        />
      {:else}
        <button
          type="button"
          on:click={() => (addingTag = true)}
          class="px-3 py-1 rounded-full border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 text-sm
                 hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue transition"
        >+ Add</button>
      {/if}
    </div>
  </div>
{/if}
