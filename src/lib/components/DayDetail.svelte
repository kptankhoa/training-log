<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { marked } from 'marked';
  import TagChip from './TagChip.svelte';
  import MarkdownEditor from './MarkdownEditor.svelte';
  import ExerciseEditor from './ExerciseEditor.svelte';
  import FormField from './FormField.svelte';
  import { saveDay } from '$lib/stores/days';
  import { addTag } from '$lib/stores/tags';
  import { uploadPhoto, getPhotoUrl, deletePhoto } from '$lib/stores/photos';
  import { GRUVBOX_COLORS } from '$lib/gruvbox';
  import { icons } from '$lib/icons';
  import type { TrainingTag, DailyTask, Exercise, ExerciseEntry, PlanNote, DayEntry } from '$lib/types';

  export let dateKey: string;      // YYYY-MM-DD
  export let entry: DayEntry;
  export let activeTags: TrainingTag[];
  export let activeTasks: DailyTask[] = [];
  export let exercises: Exercise[] = []; // full list (incl. deleted) so old logs still resolve names
  export let splits: PlanNote[] = [];
  export let allDays: Record<string, DayEntry> = {};
  export let userId: string;
  // Only useful in a height-constrained modal sheet — the inline Home page
  // has no such constraint, so it opts out.
  export let hideOtherSectionsWhileEditingNote = true;

  const dispatch = createEventDispatcher<{ saved: void }>();

  let selectedIds = new Set<string>(entry.tags);
  let selectedSplitIds = new Set<string>(entry.splitIds ?? []);
  let completedTaskIds = new Set<string>(entry.tasks ?? []);
  let label = entry.label;
  let note = entry.note;
  let newTagName = '';
  let addingTag = false;
  let saving = false;
  let saved = false;
  let savedResetTimeout: ReturnType<typeof setTimeout> | null = null;
  let noteMode: 'edit' | 'preview' = note ? 'preview' : 'edit';

  $: noteEditing = hideOtherSectionsWhileEditingNote && noteMode === 'edit';

  $: exerciseNameById = Object.fromEntries(exercises.map((e) => [e.id, e.name]));

  function cloneExerciseEntries(list: ExerciseEntry[] | undefined): ExerciseEntry[] {
    return (list ?? []).map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map((s) => ({ ...s })) }));
  }

  let exerciseEntries: ExerciseEntry[] = cloneExerciseEntries(entry.exercises);

  // Not every day has a split/exercise logged — start collapsed unless there's
  // already something there, so an empty day's edit form isn't so tall.
  let splitsExpanded = selectedSplitIds.size > 0 || exerciseEntries.length > 0;

  // Photos: uploads commit to Storage immediately (need a real ref to preview),
  // but removals only take effect on Save, so discarding edits still works.
  const originalPhotoPaths = entry.photos ?? [];
  let photoPaths = [...originalPhotoPaths];
  let photoUrls: Record<string, string> = {};
  let uploadingPhoto = false;
  let photoError = false;
  let fileInput: HTMLInputElement;
  let lightboxUrl: string | null = null;

  function hasAnyContent(): boolean {
    return selectedIds.size > 0 || selectedSplitIds.size > 0 || !!label.trim() || !!note.trim()
      || completedTaskIds.size > 0 || photoPaths.length > 0 || exerciseEntries.length > 0;
  }

  // View mode by default for a day that already has something logged —
  // jumping straight into an editable form every time feels heavy-handed.
  let mode: 'view' | 'edit' = hasAnyContent() ? 'view' : 'edit';

  $: selectedTagList = activeTags.filter((t) => selectedIds.has(t.id));
  $: selectedSplitList = splits.filter((s) => selectedSplitIds.has(s.id));

  onMount(() => {
    photoPaths.forEach((path) => {
      getPhotoUrl(path)
        .then((url) => { photoUrls[path] = url; photoUrls = photoUrls; })
        .catch((err) => console.error('[DayDetail] failed to load photo:', err));
    });
  });

  onDestroy(() => {
    if (savedResetTimeout) clearTimeout(savedResetTimeout);
    if (confirmPhotoTimeout) clearTimeout(confirmPhotoTimeout);
  });

  function toggleTag(tagId: string) {
    if (selectedIds.has(tagId)) selectedIds.delete(tagId);
    else selectedIds.add(tagId);
    selectedIds = selectedIds;
  }

  function toggleSplit(splitId: string) {
    if (selectedSplitIds.has(splitId)) selectedSplitIds.delete(splitId);
    else selectedSplitIds.add(splitId);
    selectedSplitIds = selectedSplitIds;
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
      console.error('[DayDetail] photo upload failed:', err);
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

  function startEdit() {
    mode = 'edit';
    noteMode = 'edit';
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
    splitsExpanded = selectedSplitIds.size > 0 || exerciseEntries.length > 0;
    addingTag = false;
    newTagName = '';
    if (confirmPhotoTimeout) clearTimeout(confirmPhotoTimeout);
    confirmingPhotoPath = null;
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
        mode = 'view';
      }, 1500);
    } catch (err) {
      saving = false;
      console.error('[DayDetail] save failed:', err);
    }
  }

  function autofocus(el: HTMLInputElement) {
    el.focus();
  }
</script>

{#if mode === 'view'}
  <div class="flex flex-col gap-4">
    <!-- Training types -->
    <div class="flex flex-col gap-1.5">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Training types</span>
      {#if selectedTagList.length > 0}
        <div class="flex flex-wrap gap-3">
          {#each selectedTagList as tag (tag.id)}
            <span class="flex items-center gap-1.5 text-sm text-gb-fg">
              <span class="w-2.5 h-2.5 shrink-0" style="background-color:{GRUVBOX_COLORS[tag.color]}"></span>
              {tag.name}
            </span>
          {/each}
        </div>
      {:else}
        <p class="text-gb-fg3 text-sm italic">Nothing logged yet.</p>
      {/if}
    </div>

    {#if selectedSplitList.length > 0}
      <div class="flex flex-col gap-1.5">
        <span class="text-xs text-gb-fg3 uppercase tracking-wider">Splits</span>
        <div class="flex flex-wrap gap-3">
          {#each selectedSplitList as split (split.id)}
            <span class="flex items-center gap-1.5 text-sm text-gb-fg">
              <span class="w-2.5 h-2.5 shrink-0" style="background-color:{GRUVBOX_COLORS[split.color ?? 'blue']}"></span>
              {split.label || 'Untitled'}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#if label}
      <div class="flex flex-col gap-1">
        <span class="text-xs text-gb-fg3 uppercase tracking-wider">Label</span>
        <p class="text-sm text-gb-fg">{label}</p>
      </div>
    {/if}

    {#if exerciseEntries.length > 0}
      <div class="flex flex-col gap-1.5">
        <span class="text-xs text-gb-fg3 uppercase tracking-wider">Exercises</span>
        <div class="flex flex-col gap-1">
          {#each exerciseEntries as ex (ex.exerciseId)}
            <p class="text-sm text-gb-fg">
              <span class="font-medium">{exerciseNameById[ex.exerciseId] ?? 'Unknown exercise'}</span>
              {#if ex.sets.length > 0}
                <span class="text-gb-fg3"> — {ex.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')}</span>
              {:else}
                <span class="text-gb-fg3 italic"> — no sets logged</span>
              {/if}
            </p>
          {/each}
        </div>
      </div>
    {/if}

    {#if activeTasks.length > 0}
      <div class="flex flex-col gap-1.5">
        <span class="text-xs text-gb-fg3 uppercase tracking-wider">Daily tasks</span>
        <div class="flex flex-col gap-1">
          {#each activeTasks as task (task.id)}
            <span class="text-sm flex items-center gap-2 {completedTaskIds.has(task.id) ? 'text-gb-fg' : 'text-gb-fg3'}">
              <span>{completedTaskIds.has(task.id) ? '✓' : '○'}</span>
              {task.name}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    <div class="flex flex-col gap-1">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Notes</span>
      {#if note}
        <div class="prose prose-invert max-w-none text-sm text-gb-fg
                    [&_h1]:text-gb-green [&_h2]:text-gb-green [&_h3]:text-gb-green
                    [&_strong]:text-gb-orange [&_a]:text-gb-blue">
          {@html marked(note)}
        </div>
      {:else}
        <p class="text-gb-fg3 text-sm italic">No notes yet.</p>
      {/if}
    </div>

    {#if photoPaths.length > 0}
      <div class="flex flex-col gap-1.5">
        <span class="text-xs text-gb-fg3 uppercase tracking-wider">Progress photos</span>
        <div class="flex flex-wrap gap-2">
          {#each photoPaths as path (path)}
            <button
              type="button"
              on:click={() => (lightboxUrl = photoUrls[path] ?? null)}
              disabled={!photoUrls[path]}
              class="w-20 h-20 shrink-0 bg-gb-bg2 border border-gb-bg3 overflow-hidden flex items-center justify-center"
            >
              {#if photoUrls[path]}
                <img src={photoUrls[path]} alt="Training day snapshot" class="w-full h-full object-cover" />
              {:else}
                <span class="w-4 h-4 rounded-full border-2 border-gb-bg3 border-t-gb-green animate-spin"></span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <button
      type="button"
      on:click={startEdit}
      class="self-end flex items-center gap-1.5 bg-gb-blue text-gb-bg font-semibold text-sm px-4 py-2 hover:opacity-90 transition"
    >{@html icons.pencilSm}Edit</button>
  </div>
{:else}
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

  <!-- Splits & Exercises -->
  <div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-2">
    <button
      type="button"
      on:click={() => (splitsExpanded = !splitsExpanded)}
      class="flex items-center justify-between text-xs text-gb-fg3 uppercase tracking-wider"
    >
      <span>Splits & Exercises</span>
      <span class="text-sm leading-none">{splitsExpanded ? '−' : '+'}</span>
    </button>
    {#if splitsExpanded}
      <div class="flex flex-col gap-3" transition:slide={{ duration: 200 }}>
        <div class="flex flex-col gap-2">
          <span class="text-xs text-gb-fg3 uppercase tracking-wider">Splits</span>
          <div class="flex flex-wrap gap-2">
            {#each splits as split (split.id)}
              <button
                type="button"
                on:click={() => toggleSplit(split.id)}
                class="px-3 py-1 rounded-full border text-sm transition
                       {selectedSplitIds.has(split.id)
                         ? 'border-gb-green text-gb-green bg-gb-bg2'
                         : 'border-gb-bg3 text-gb-fg3 hover:border-gb-blue hover:text-gb-blue'}"
              >{split.label || 'Untitled'}</button>
            {/each}
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-xs text-gb-fg3 uppercase tracking-wider">Exercises</span>
          <ExerciseEditor {exercises} {allDays} {dateKey} {userId} daySplitIds={[...selectedSplitIds]} bind:entries={exerciseEntries} />
        </div>
      </div>
    {/if}
  </div>

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

  <div class="flex justify-end gap-2">
    <button
      type="button"
      on:click={cancelEdit}
      disabled={saving}
      class="text-gb-fg3 text-sm hover:text-gb-fg transition px-3 py-2"
    >Cancel</button>
    <button
      type="button"
      on:click={handleSave}
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
{/if}

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
