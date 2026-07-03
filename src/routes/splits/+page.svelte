<script lang="ts">
  import { marked } from 'marked';
  import { user } from '$lib/stores/auth';
  import { splits, splitsLoading, addSplit, saveSplit, deleteSplit } from '$lib/stores/splits';
  import { activeExercises, updateExerciseSplits } from '$lib/stores/exercises';
  import { generalRules, generalRulesLoading, saveGeneralRules } from '$lib/stores/generalRules';
  import { icons } from '$lib/icons';
  import { gruvboxColors, COLOR_ORDER } from '$lib/gruvbox';
  import { navColorClasses } from '$lib/navColors';
  import MarkdownEditor from '$lib/components/shared/MarkdownEditor.svelte';
  import Spinner from '$lib/components/shared/Spinner.svelte';
  import type { Split, GruvboxColor, Exercise } from '$lib/types';

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

  function toggle(split: Split) {
    if (expandedId === split.id) {
      expandedId = null;
      editingId = null;
      draft = null;
    } else {
      expandedId = split.id;
      editingId = null;
      draft = null;
    }
    resetDeleteConfirm();
  }

  function startEdit(split: Split) {
    editingId = split.id;
    draft = { label: split.label, sortOrder: split.sortOrder, content: split.content, color: split.color ?? 'blue' };
    resetDeleteConfirm();
  }

  function cancelEdit() {
    editingId = null;
    draft = null;
    resetDeleteConfirm();
  }

  async function handleSave(splitId: string) {
    if (!draft || !userId) return;
    await saveSplit(userId, splitId, { label: draft.label, sortOrder: Number(draft.sortOrder), content: draft.content, color: draft.color });
    editingId = null;
    draft = null;
  }

  async function handleDelete(splitId: string) {
    if (!userId) return;
    await deleteSplit(userId, splitId);
    expandedId = null;
    editingId = null;
    draft = null;
  }

  function handleDeleteClick(splitId: string) {
    if (confirmingDelete) {
      resetDeleteConfirm();
      handleDelete(splitId);
      return;
    }
    confirmingDelete = true;
    if (confirmDeleteTimeout) clearTimeout(confirmDeleteTimeout);
    confirmDeleteTimeout = setTimeout(() => { confirmingDelete = false; }, 3000);
  }

  async function handleAdd() {
    if (!userId) return;
    await addSplit(userId);
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

  // General Rules — a single global note, view mode by default once loaded
  // (edit mode if empty), same pattern as everywhere else in the app.
  let rulesMode: 'view' | 'edit' = 'edit';
  let rulesInitialized = false;
  let rulesDraft = '';
  let savingRules = false;

  $: if (!$generalRulesLoading && !rulesInitialized) {
    rulesInitialized = true;
    rulesMode = $generalRules ? 'view' : 'edit';
  }

  function startEditRules() {
    rulesDraft = $generalRules;
    rulesMode = 'edit';
  }

  function cancelEditRules() {
    rulesMode = $generalRules ? 'view' : 'edit';
  }

  async function saveRules() {
    if (savingRules) return;
    savingRules = true;
    try {
      await saveGeneralRules(userId, rulesDraft);
      rulesMode = 'view';
    } finally {
      savingRules = false;
    }
  }
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold {navColorClasses('/splits')}">Split Design</h1>
    <button
      type="button"
      on:click={handleAdd}
      class="bg-gb-light-blue dark:bg-gb-blue text-gb-light-bg dark:text-gb-bg font-semibold px-4 py-2 text-sm hover:opacity-90 transition"
    >+ Add</button>
  </div>

  {#if $splitsLoading}
    <Spinner />
  {:else if $splits.length === 0}
    <p class="text-gb-light-fg3 dark:text-gb-fg3 text-sm">No splits yet. Add one to get started.</p>
  {/if}

  <div class="flex flex-col gap-2">
    {#each $splits as split (split.id)}
      <div class="bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg2 dark:border-gb-bg2">

        <!-- Header / toggle -->
        <button
          type="button"
          on:click={() => toggle(split)}
          class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gb-light-bg2 dark:hover:bg-gb-bg2 transition"
        >
          <span class="w-3 h-3 shrink-0" style="background-color:{$gruvboxColors[split.color ?? 'blue']}"></span>
          <span class="font-semibold text-gb-light-fg dark:text-gb-fg text-sm flex-1">{split.label || 'Untitled'}</span>
          <span class="text-gb-light-fg3 dark:text-gb-fg3 text-xs shrink-0">{expandedId === split.id ? '▲' : '▼'}</span>
        </button>

        {#if expandedId === split.id}
          <div class="border-t border-gb-light-bg2 dark:border-gb-bg2">

            {#if editingId === split.id && draft}
              <!-- Edit mode -->
              <div class="px-4 py-4 flex flex-col gap-4">
                <div class="flex gap-3 items-end">
                  <button
                    type="button"
                    on:click|stopPropagation={cycleColor}
                    style="background-color:{$gruvboxColors[draft.color]}"
                    title="Click to change color"
                    class="w-6 h-9 shrink-0 hover:opacity-80 transition-opacity"
                  ></button>
                  <div class="flex flex-col gap-1 flex-1">
                    <label for="label-{split.id}" class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Label</label>
                    <input
                      id="label-{split.id}"
                      type="text"
                      bind:value={draft.label}
                      class="bg-gb-light-bg2 dark:bg-gb-bg2 text-gb-light-fg dark:text-gb-fg text-sm px-3 py-2 border border-gb-light-bg3 dark:border-gb-bg3
                             focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue w-full"
                    />
                  </div>
                  <div class="flex flex-col gap-1 w-20">
                    <label for="order-{split.id}" class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Order</label>
                    <input
                      id="order-{split.id}"
                      type="number"
                      bind:value={draft.sortOrder}
                      class="bg-gb-light-bg2 dark:bg-gb-bg2 text-gb-light-fg dark:text-gb-fg text-sm px-3 py-2 border border-gb-light-bg3 dark:border-gb-bg3
                             focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue w-full"
                    />
                  </div>
                </div>

                <MarkdownEditor bind:value={draft.content} placeholder="Write your split…" initialMode="edit" />

                <div class="flex flex-col gap-2">
                  <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Exercises</span>
                  {#if $activeExercises.length === 0}
                    <p class="text-gb-light-fg3 dark:text-gb-fg3 text-xs italic">No exercises yet — add some in Settings.</p>
                  {:else}
                    <div class="flex flex-wrap gap-2">
                      {#each $activeExercises as exercise (exercise.id)}
                        <button
                          type="button"
                          on:click={() => toggleExerciseTie(exercise, split.id)}
                          class="px-3 py-1 text-xs border transition
                                 {isExerciseTied(exercise, split.id)
                                   ? 'border-gb-light-green dark:border-gb-green text-gb-light-green dark:text-gb-green bg-gb-light-bg2 dark:bg-gb-bg2'
                                   : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue'}"
                        >{exercise.name}</button>
                      {/each}
                    </div>
                  {/if}
                </div>

                <div class="flex justify-between">
                  <button
                    type="button"
                    on:click={() => handleDeleteClick(split.id)}
                    class="text-sm font-medium hover:opacity-80 transition px-2 py-1
                           {confirmingDelete ? 'text-white bg-gb-light-red dark:bg-gb-red' : 'text-gb-light-red dark:text-gb-red'}"
                  >{confirmingDelete ? 'Confirm delete?' : 'Delete'}</button>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      on:click={cancelEdit}
                      class="text-gb-light-fg3 dark:text-gb-fg3 text-sm hover:text-gb-light-fg dark:hover:text-gb-fg transition px-3 py-2"
                    >Cancel</button>
                    <button
                      type="button"
                      on:click={() => handleSave(split.id)}
                      class="bg-gb-light-green dark:bg-gb-green text-gb-light-bg dark:text-gb-bg font-semibold px-5 py-2 text-sm hover:opacity-90 transition"
                    >Save</button>
                  </div>
                </div>
              </div>

            {:else}
              <!-- View mode -->
              <div class="px-4 py-4 flex flex-col gap-4">
                {#if split.content}
                  <div class="prose prose-invert max-w-none text-sm text-gb-light-fg dark:text-gb-fg
                              [&_h1]:text-gb-light-green dark:[&_h1]:text-gb-green [&_h2]:text-gb-light-green dark:[&_h2]:text-gb-green [&_h3]:text-gb-light-green dark:[&_h3]:text-gb-green
                              [&_strong]:text-gb-light-orange dark:[&_strong]:text-gb-orange [&_a]:text-gb-light-blue dark:[&_a]:text-gb-blue">
                    {@html marked(split.content)}
                  </div>
                {:else}
                  <p class="text-gb-light-fg3 dark:text-gb-fg3 text-sm italic">No content yet.</p>
                {/if}
                <div class="flex justify-end">
                  <button
                    type="button"
                    on:click={() => startEdit(split)}
                    class="bg-gb-light-bg2 dark:bg-gb-bg2 text-gb-light-fg dark:text-gb-fg text-sm px-4 py-2 hover:bg-gb-light-bg3 dark:hover:bg-gb-bg3 transition"
                  >Update</button>
                </div>
              </div>
            {/if}

          </div>
        {/if}
      </div>
    {/each}
  </div>

  <section class="bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg2 dark:border-gb-bg2 p-4 flex flex-col gap-3">
    <h2 class="text-gb-light-fg dark:text-gb-fg font-semibold text-sm uppercase tracking-wider">General Rules</h2>

    {#if $generalRulesLoading}
      <Spinner size="w-5 h-5" />
    {:else if rulesMode === 'view'}
      {#if $generalRules}
        <div class="prose prose-invert max-w-none text-sm text-gb-light-fg dark:text-gb-fg
                    [&_h1]:text-gb-light-green dark:[&_h1]:text-gb-green [&_h2]:text-gb-light-green dark:[&_h2]:text-gb-green [&_h3]:text-gb-light-green dark:[&_h3]:text-gb-green
                    [&_strong]:text-gb-light-orange dark:[&_strong]:text-gb-orange [&_a]:text-gb-light-blue dark:[&_a]:text-gb-blue">
          {@html marked($generalRules)}
        </div>
      {:else}
        <p class="text-gb-light-fg3 dark:text-gb-fg3 text-sm italic">No general rules yet.</p>
      {/if}
      <button
        type="button"
        on:click={startEditRules}
        class="self-end flex items-center gap-1.5 bg-gb-light-blue dark:bg-gb-blue text-gb-light-bg dark:text-gb-bg font-semibold text-sm px-4 py-2 hover:opacity-90 transition"
      >{@html icons.pencilSm}Edit</button>
    {:else}
      <MarkdownEditor bind:value={rulesDraft} placeholder="General training rules, guidelines…" initialMode="edit" rows={8} />
      <div class="flex justify-end gap-2">
        <button
          type="button"
          on:click={cancelEditRules}
          class="text-gb-light-fg3 dark:text-gb-fg3 text-sm hover:text-gb-light-fg dark:hover:text-gb-fg transition px-3 py-2"
        >Cancel</button>
        <button
          type="button"
          on:click={saveRules}
          disabled={savingRules}
          class="bg-gb-light-green dark:bg-gb-green text-gb-light-bg dark:text-gb-bg font-semibold px-5 py-2 text-sm hover:opacity-90 transition disabled:opacity-60"
        >{savingRules ? 'Saving…' : 'Save'}</button>
      </div>
    {/if}
  </section>
</div>
