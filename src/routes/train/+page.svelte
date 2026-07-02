<script lang="ts">
  import { onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { marked } from 'marked';
  import { notes, notesLoading } from '$lib/stores/notes';
  import { allDays, daysLoading, saveDay } from '$lib/stores/days';
  import { exercises } from '$lib/stores/exercises';
  import { user } from '$lib/stores/auth';
  import { GRUVBOX_COLORS } from '$lib/gruvbox';
  import Spinner from '$lib/components/Spinner.svelte';
  import ExerciseEditor from '$lib/components/ExerciseEditor.svelte';
  import type { PlanNote, ExerciseEntry, DayEntry } from '$lib/types';

  let selectedId: string | null = null;
  $: selectedSplit = $notes.find((n) => n.id === selectedId) ?? null;

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

  const PRESETS = [30, 60, 75, 90, 120];

  // Timer state
  let inputSeconds = 60;
  let remaining = 0;
  let running = false;
  let finished = false;
  let interval: ReturnType<typeof setInterval> | null = null;

  $: totalInput = inputSeconds;

  function startStop() {
    if (running) {
      pause();
    } else {
      if (remaining === 0 || finished) {
        remaining = totalInput;
        finished = false;
      }
      start();
    }
  }

  function start() {
    running = true;
    interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        remaining = 0;
        running = false;
        finished = true;
        clearInterval(interval!);
        interval = null;
      }
    }, 1000);
  }

  function pause() {
    running = false;
    if (interval) { clearInterval(interval); interval = null; }
  }

  function reset() {
    pause();
    remaining = 0;
    finished = false;
  }

  function selectPreset(secs: number) {
    inputSeconds = secs;
    reset();
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  $: displayTime = remaining > 0 ? formatTime(remaining) : formatTime(totalInput);
  $: progress = remaining > 0 ? remaining / totalInput : (finished ? 0 : 1);

  // Circumference for the SVG ring
  const R = 54;
  const C = 2 * Math.PI * R;
  $: dashOffset = C * (1 - progress);

  onDestroy(() => {
    if (interval) clearInterval(interval);
    if (exercisesSavedResetTimeout) clearTimeout(exercisesSavedResetTimeout);
  });
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
  <h1 class="text-gb-green text-2xl font-bold glow-green">Train</h1>

  <!-- Split picker -->
  <section class="flex flex-col gap-2">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2 text-sm uppercase tracking-wider">Select Split</h2>
    {#if $notesLoading}
      <Spinner />
    {:else if $notes.length === 0}
      <p class="text-gb-fg3 text-sm">No splits yet — add one in <a href="/splits" class="text-gb-blue underline">Split Design</a>.</p>
    {:else}
      <div class="flex flex-wrap gap-2">
        {#each $notes as split (split.id)}
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

  <!-- Rest timer -->
  <section class="flex flex-col gap-4">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2 text-sm uppercase tracking-wider">Rest Timer</h2>

    <!-- Ring + time display -->
    <div class="flex flex-col items-center gap-6">
      <div class="relative w-[10.5rem] h-[10.5rem]">
        <svg class="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" class="text-gb-bg2" stroke-width="8"/>
          <circle
            cx="60" cy="60" r={R} fill="none"
            stroke="currentColor"
            class="{finished ? 'text-gb-red' : 'text-gb-green'} transition-all duration-1000"
            stroke-width="8"
            stroke-linecap="round"
            stroke-dasharray={C}
            stroke-dashoffset={finished ? 0 : dashOffset}
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          {#if finished}
            <span class="text-xs font-semibold uppercase tracking-widest" style="color:#fb4934">Go!</span>
          {:else if running}
            <span class="text-xs uppercase tracking-widest" style="color:#a89984">Rest</span>
          {:else}
            <span class="text-xs uppercase tracking-widest opacity-0">·</span>
          {/if}
          <span class="text-2xl font-bold tabular-nums" style="color:{finished ? '#fb4934' : running ? '#b8bb26' : '#ebdbb2'}">{displayTime}</span>
        </div>
      </div>

      <!-- Duration input -->
      <div class="flex items-center gap-2 text-sm">
        <label for="rest-seconds" class="text-gb-fg3">Rest:</label>
        <input
          id="rest-seconds"
          type="number" min="1" max="3600"
          bind:value={inputSeconds}
          on:change={reset}
          disabled={running || (remaining > 0 && !finished)}
          class="w-16 text-center bg-gb-bg1 border border-gb-bg3 text-gb-fg px-2 py-1
                 focus:outline-none focus:border-gb-blue disabled:opacity-40"
        />
        <span class="text-gb-fg3">sec</span>
      </div>

      <!-- Presets -->
      <div class="flex gap-2 flex-wrap justify-center">
        {#each PRESETS as secs}
          <button
            type="button"
            on:click={() => selectPreset(secs)}
            disabled={running || (remaining > 0 && !finished)}
            class="px-3 py-1 text-sm border transition disabled:opacity-40
                   {inputSeconds === secs
                     ? 'border-gb-green text-gb-green bg-gb-bg1'
                     : 'border-gb-bg3 text-gb-fg2 bg-gb-bg hover:bg-gb-bg1'}"
          >{secs}s</button>
        {/each}
      </div>

      <!-- Controls -->
      <div class="flex gap-3">
        <button
          type="button"
          on:click={startStop}
          disabled={totalInput === 0}
          class="px-6 py-2 font-semibold text-sm transition hover:opacity-90 disabled:opacity-40"
          style={running ? 'background:#fe8019;color:#fff' : 'background:#b8bb26;color:#1d2021'}
        >
          {running ? 'Pause' : remaining > 0 && !finished ? 'Resume' : 'Start'}
        </button>
        <button
          type="button"
          on:click={reset}
          class="px-4 py-2 text-sm text-gb-fg3 border border-gb-bg3 hover:bg-gb-bg1 transition"
        >
          Reset
        </button>
      </div>
    </div>
  </section>

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
