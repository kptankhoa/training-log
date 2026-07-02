<script lang="ts">
  import { onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { marked } from 'marked';
  import { splits, splitsLoading } from '$lib/stores/splits';
  import { allDays, daysLoading, saveDay } from '$lib/stores/days';
  import { exercises } from '$lib/stores/exercises';
  import { user } from '$lib/stores/auth';
  import { GRUVBOX_COLORS } from '$lib/gruvbox';
  import Spinner from '$lib/components/shared/Spinner.svelte';
  import ExerciseEditor from '$lib/components/day-detail/ExerciseEditor.svelte';
  import RestTimer from '$lib/components/train/RestTimer.svelte';
  import type { ExerciseEntry, DayEntry } from '$lib/types';

  let selectedId: string | null = null;
  $: selectedSplit = $splits.find((n) => n.id === selectedId) ?? null;

  $: userId = $user?.uid ?? '';

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Logging exercises here is a quick add for today — no need to preview
  // what's already logged on this page, just carry it into the day's entry
  // (visible on the day's own detail view).
  let exercisesExpanded = false;

  function cloneExerciseEntries(list: ExerciseEntry[] | undefined): ExerciseEntry[] {
    return (list ?? []).map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map((s) => ({ ...s })) }));
  }

  let exerciseEntries: ExerciseEntry[] = [];
  let exercisesInitialized = false;
  $: if (!exercisesInitialized && !$daysLoading) {
    exerciseEntries = cloneExerciseEntries($allDays[todayKey]?.exercises);
    exercisesInitialized = true;
  }

  let exercisesSaving = false;
  let exercisesSaved = false;
  let exercisesSavedResetTimeout: ReturnType<typeof setTimeout> | null = null;

  async function handleSaveExercises() {
    if (!userId || exercisesSaving || exercisesSaved) return;
    exercisesSaving = true;
    try {
      const existing = $allDays[todayKey];
      const merged: DayEntry = {
        tags: existing?.tags ?? [],
        label: existing?.label ?? '',
        note: existing?.note ?? '',
        tasks: existing?.tasks,
        photos: existing?.photos,
        splitIds: existing?.splitIds,
        exercises: exerciseEntries,
      };
      await saveDay(userId, todayKey, merged);
      exercisesSaving = false;
      exercisesSaved = true;
      if (exercisesSavedResetTimeout) clearTimeout(exercisesSavedResetTimeout);
      exercisesSavedResetTimeout = setTimeout(() => { exercisesSaved = false; }, 1500);
    } catch (err) {
      exercisesSaving = false;
      console.error('[Train] failed to save exercises:', err);
    }
  }

  onDestroy(() => {
    if (exercisesSavedResetTimeout) clearTimeout(exercisesSavedResetTimeout);
  });
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
  <h1 class="text-gb-green text-2xl font-bold glow-green">Train</h1>

  <!-- Split picker -->
  <section class="flex flex-col gap-2">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2 text-sm uppercase tracking-wider">Select Split</h2>
    {#if $splitsLoading}
      <Spinner />
    {:else if $splits.length === 0}
      <p class="text-gb-fg3 text-sm">No splits yet — add one in <a href="/splits" class="text-gb-blue underline">Split Design</a>.</p>
    {:else}
      <div class="flex flex-wrap gap-2">
        {#each $splits as split (split.id)}
          <button
            type="button"
            on:click={() => selectedId = selectedId === split.id ? null : split.id}
            class="flex items-center gap-2 px-3 py-2 text-sm border transition
                   {selectedId === split.id
                     ? 'border-gb-green text-gb-green bg-gb-bg1'
                     : 'border-gb-bg3 text-gb-fg2 bg-gb-bg hover:bg-gb-bg1'}"
          >
            <span class="w-2.5 h-2.5 shrink-0 rounded-sm" style="background-color:{GRUVBOX_COLORS[split.color ?? 'blue']}"></span>
            {split.label || 'Untitled'}
          </button>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Split content -->
  {#if selectedSplit}
    <section class="flex flex-col gap-2">
      <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2 text-sm uppercase tracking-wider">{selectedSplit.label}</h2>
      {#if selectedSplit.content}
        <div class="prose prose-invert max-w-none text-sm text-gb-fg
                    [&_h1]:text-gb-green [&_h2]:text-gb-green [&_h3]:text-gb-green
                    [&_strong]:text-gb-orange [&_a]:text-gb-blue [&_li]:text-gb-fg">
          {@html marked(selectedSplit.content)}
        </div>
      {:else}
        <p class="text-gb-fg3 text-sm italic">No content for this split.</p>
      {/if}
    </section>
  {/if}

  <RestTimer />

  <!-- Exercises -->
  <section class="flex flex-col gap-2">
    <button
      type="button"
      on:click={() => (exercisesExpanded = !exercisesExpanded)}
      class="flex items-center justify-between text-gb-fg font-semibold border-b border-gb-bg2 pb-2 text-sm uppercase tracking-wider"
    >
      <span>Exercises</span>
      <span class="text-sm leading-none normal-case tracking-normal">{exercisesExpanded ? '−' : '+'}</span>
    </button>
    {#if exercisesExpanded}
      <div class="flex flex-col gap-3" transition:slide={{ duration: 200 }}>
        <ExerciseEditor
          exercises={$exercises}
          allDays={$allDays}
          dateKey={todayKey}
          {userId}
          daySplitIds={selectedId ? [selectedId] : []}
          bind:entries={exerciseEntries}
        />
        <button
          type="button"
          on:click={handleSaveExercises}
          disabled={exercisesSaving || exercisesSaved}
          class="bg-gb-green text-gb-bg font-semibold py-2.5 rounded-md
                 transition-transform hover:opacity-90 active:scale-[0.98]
                 disabled:opacity-90 flex items-center justify-center gap-2"
        >
          {#if exercisesSaved}
            <span>✓ Saved</span>
          {:else if exercisesSaving}
            <span class="w-4 h-4 rounded-full border-2 border-gb-bg border-t-transparent animate-spin"></span>
            <span>Saving…</span>
          {:else}
            <span>Save</span>
          {/if}
        </button>
      </div>
    {/if}
  </section>
</div>
