<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import TagChip from './TagChip.svelte';
  import MarkdownEditor from './MarkdownEditor.svelte';
  import { onMount } from 'svelte';
  import { saveDay } from '$lib/stores/days';
  import { addTag } from '$lib/stores/tags';
  import { uploadPhoto, getPhotoUrl, deletePhoto } from '$lib/stores/photos';
  import type { TrainingTag, DailyTask, DayEntry } from '$lib/types';

  export let dateKey: string;      // YYYY-MM-DD
  export let entry: DayEntry;
  export let activeTags: TrainingTag[];
  export let activeTasks: DailyTask[] = [];
  export let userId: string;

  const dispatch = createEventDispatcher();

  let selectedIds = new Set<string>(entry.tags);
  let completedTaskIds = new Set<string>(entry.tasks ?? []);
  let label = entry.label;
  let note = entry.note;
  let newTagName = '';
  let addingTag = false;
  let saving = false;
  let saved = false;
  let noteMode: 'edit' | 'preview' = note ? 'preview' : 'edit';

  $: noteEditing = noteMode === 'edit';

  // Photos: uploads commit to Storage immediately (need a real ref to preview),
  // but removals only take effect on Save, so Close still fully discards them.
  const originalPhotoPaths = entry.photos ?? [];
  let photoPaths = [...originalPhotoPaths];
  let photoUrls: Record<string, string> = {};
  let uploadingPhoto = false;
  let photoError = false;
  let fileInput: HTMLInputElement;
  let lightboxUrl: string | null = null;

  // position: fixed sizes against the layout viewport, which doesn't shrink when
  // the mobile keyboard opens — track the visual viewport so the sheet resizes
  // to stay above the keyboard instead of being covered by it.
  let viewportHeight = '100dvh';

  function updateViewportHeight() {
    if (window.visualViewport) viewportHeight = `${window.visualViewport.height}px`;
  }

  onMount(() => {
    updateViewportHeight();
    window.visualViewport?.addEventListener('resize', updateViewportHeight);

    photoPaths.forEach((path) => {
      getPhotoUrl(path)
        .then((url) => { photoUrls[path] = url; photoUrls = photoUrls; })
        .catch((err) => console.error('[DayModal] failed to load photo:', err));
    });

    return () => window.visualViewport?.removeEventListener('resize', updateViewportHeight);
  });

  $: [yr, mo, dy] = dateKey.split('-').map(Number);
  $: heading = new Date(yr, mo - 1, dy).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  function toggleTag(tagId: string) {
    if (selectedIds.has(tagId)) selectedIds.delete(tagId);
    else selectedIds.add(tagId);
    selectedIds = selectedIds;
  }

  function toggleTask(taskId: string) {
    if (completedTaskIds.has(taskId)) completedTaskIds.delete(taskId);
    else completedTaskIds.add(taskId);
    completedTaskIds = completedTaskIds;
  }

  async function commitNewTag() {
    if (!newTagName.trim()) { addingTag = false; return; }
    await addTag(userId, newTagName.trim());
    newTagName = '';
    addingTag = false;
  }

  function triggerPhotoPicker() {
    fileInput?.click();
  }

  async function handlePhotoSelect(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    uploadingPhoto = true;
    photoError = false;
    try {
      const path = await uploadPhoto(userId, dateKey, file);
      const url = await getPhotoUrl(path);
      photoUrls[path] = url;
      photoUrls = photoUrls;
      photoPaths = [...photoPaths, path];
    } catch (err) {
      photoError = true;
      console.error('[DayModal] photo upload failed:', err);
    } finally {
      uploadingPhoto = false;
    }
  }

  function removePhoto(path: string) {
    photoPaths = photoPaths.filter((p) => p !== path);
  }

  // "Click again to confirm" delete pattern — arms for 3s, then auto-reverts.
  let confirmingPhotoPath: string | null = null;
  let confirmPhotoTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleRemovePhotoClick(path: string) {
    if (confirmingPhotoPath === path) {
      if (confirmPhotoTimeout) clearTimeout(confirmPhotoTimeout);
      confirmingPhotoPath = null;
      removePhoto(path);
      return;
    }
    confirmingPhotoPath = path;
    if (confirmPhotoTimeout) clearTimeout(confirmPhotoTimeout);
    confirmPhotoTimeout = setTimeout(() => { confirmingPhotoPath = null; }, 3000);
  }

  async function handleSave() {
    if (saving || saved) return;
    saving = true;
    try {
      const removedPaths = originalPhotoPaths.filter((p) => !photoPaths.includes(p));
      await saveDay(userId, dateKey, { tags: [...selectedIds], label, note, tasks: [...completedTaskIds], photos: photoPaths });
      await Promise.all(
        removedPaths.map((p) => deletePhoto(p).catch((err) => console.error('[DayModal] failed to delete photo:', err)))
      );
      saving = false;
      saved = true;
      setTimeout(() => dispatch('close'), 450);
    } catch (err) {
      saving = false;
      console.error('[DayModal] save failed:', err);
    }
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
  class="fixed top-0 left-0 right-0 bg-black/60 z-60 flex items-end md:items-center justify-center"
  style="height: {viewportHeight};"
  on:click|self={() => dispatch('close')}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  tabindex="-1"
>
  <div class="bg-gb-bg1 w-full md:w-[520px] max-h-[85%] overflow-y-auto
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
    <div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-2">
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
    <div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-1">
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

    <!-- Progress photos -->
    <div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-2">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Progress photos</span>
      <div class="flex flex-wrap gap-2">
        {#each photoPaths as path (path)}
          <div class="relative w-20 h-20 shrink-0 bg-gb-bg2 border border-gb-bg3">
            <button
              type="button"
              on:click={() => (lightboxUrl = photoUrls[path] ?? null)}
              disabled={!photoUrls[path]}
              class="w-full h-full flex items-center justify-center"
            >
              {#if photoUrls[path]}
                <img src={photoUrls[path]} alt="Training day snapshot" class="w-full h-full object-cover" />
              {:else}
                <span class="w-4 h-4 rounded-full border-2 border-gb-bg3 border-t-gb-green animate-spin"></span>
              {/if}
            </button>
            <button
              type="button"
              on:click={() => handleRemovePhotoClick(path)}
              aria-label={confirmingPhotoPath === path ? 'Confirm remove photo' : 'Remove photo'}
              class="absolute -top-1.5 -right-1.5 flex items-center justify-center
                     bg-gb-red text-white leading-none transition-all
                     {confirmingPhotoPath === path ? 'px-1.5 h-5 text-[10px] font-semibold' : 'w-5 h-5 text-xs'}"
            >{confirmingPhotoPath === path ? 'Sure?' : '✕'}</button>
          </div>
        {/each}

        {#if uploadingPhoto}
          <div class="w-20 h-20 shrink-0 bg-gb-bg2 border border-gb-bg3 flex items-center justify-center">
            <span class="w-4 h-4 rounded-full border-2 border-gb-bg3 border-t-gb-green animate-spin"></span>
          </div>
        {/if}

        <button
          type="button"
          on:click={triggerPhotoPicker}
          disabled={uploadingPhoto}
          aria-label="Add photo"
          class="w-20 h-20 shrink-0 border border-dashed border-gb-bg3 text-gb-fg3 text-2xl
                 hover:border-gb-blue hover:text-gb-blue transition disabled:opacity-40"
        >+</button>
      </div>
      {#if photoError}
        <span class="text-xs text-gb-red">Upload failed — try again.</span>
      {/if}
      <input
        bind:this={fileInput}
        data-testid="photo-file-input"
        type="file"
        accept="image/*"
        capture="environment"
        on:change={handlePhotoSelect}
        class="hidden"
      />
    </div>

    <button
      type="button"
      on:click={handleSave}
      disabled={saving || saved}
      class="w-full bg-gb-green text-gb-bg font-semibold py-2.5 rounded-md
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
</div>

{#if lightboxUrl}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4"
    on:click={() => (lightboxUrl = null)}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <img src={lightboxUrl} alt="Training day snapshot" class="max-w-full max-h-full object-contain" />
    <button
      type="button"
      on:click={() => (lightboxUrl = null)}
      aria-label="Close photo"
      class="absolute top-4 right-4 text-white text-3xl leading-none"
    >×</button>
  </div>
{/if}
