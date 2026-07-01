<script lang="ts">
  import { onMount } from 'svelte';
  import { user, signOut } from '$lib/stores/auth';
  import { icons } from '$lib/icons';
  import { activeTags, addTag, deleteTag, updateTagColor, initTags } from '$lib/stores/tags';
  import { GRUVBOX_COLORS, COLOR_ORDER } from '$lib/gruvbox';
  import type { GruvboxColor } from '$lib/types';

  $: userId = $user?.uid ?? '';

  let unsubTags: (() => void) | null = null;

  onMount(() => {
    const unsubUser = user.subscribe((u) => {
      if (!u) return;
      unsubTags?.(); unsubTags = initTags(u.uid);
    });
    return () => { unsubUser(); unsubTags?.(); };
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
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-10">
  <h1 class="text-gb-green text-2xl font-bold glow-green">Settings</h1>

  <section class="flex flex-col gap-4">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2">Training Types</h2>

    <ul class="flex flex-col gap-2">
      {#each $activeTags as tag (tag.id)}
        <li class="flex items-center gap-3 bg-gb-bg1 px-4 py-3">
          <button
            type="button"
            on:click={() => cycleColor(tag.id, tag.color)}
            style="background-color: {GRUVBOX_COLORS[tag.color]}"
            class="w-5 h-5 shrink-0 border-2 border-gb-bg3 hover:scale-110 transition-transform"
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
        class="flex-1 bg-gb-bg1 text-gb-fg text-sm px-3 py-2
               border border-gb-bg2 focus:outline-none focus:border-gb-blue"
      />
      <button
        type="button"
        on:click={handleAdd}
        class="bg-gb-blue text-gb-bg font-semibold px-4 py-2 hover:opacity-90 transition text-sm"
      >Add</button>
    </div>
  </section>

  <section class="md:hidden flex flex-col gap-2">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2">Account</h2>
    <button
      type="button"
      on:click={signOut}
      class="flex items-center gap-3 px-4 py-3 bg-gb-bg1 text-gb-fg3
             hover:text-gb-red hover:bg-gb-bg2 transition-colors text-sm w-full text-left"
    >
      {@html icons.signOutSm}
      Sign out
    </button>
  </section>
</div>
