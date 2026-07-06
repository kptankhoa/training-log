<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { holdRepeat } from '$lib/actions/holdRepeat';
  import { addExercise } from '$lib/stores/exercises';
  import { getLastLoggedSet, getLastSessionExercises } from '$lib/exerciseHistory';
  import { showError } from '$lib/stores/toast';
  import { formatSet } from '$lib/types';
  import type { Exercise, ExerciseEntry, ExerciseSet, ExerciseType, Equipment, DayEntry } from '$lib/types';

  export let exercises: Exercise[] = []; // full catalog, incl. deleted, for name resolution
  export let allDays: Record<string, DayEntry> = {};
  export let dateKey: string;
  export let userId: string;
  export let entries: ExerciseEntry[] = [];
  // Splits selected for this day — narrows the pickable list to exercises tied
  // to one of them (plus untied exercises, which are always available). No
  // splits selected means no filtering at all.
  export let daySplitIds: string[] = [];

  $: activeExerciseCatalog = exercises.filter((e) => !e.deleted);
  $: exerciseById = Object.fromEntries(exercises.map((e) => [e.id, e])) as Record<string, Exercise>;
  $: pickableExercises = activeExerciseCatalog.filter((ex) => {
    if (entries.some((e) => e.exerciseId === ex.id)) return false;
    if (daySplitIds.length === 0) return true;
    const tiedSplits = ex.splitIds ?? [];
    return tiedSplits.length === 0 || tiedSplits.some((sid) => daySplitIds.includes(sid));
  });
  $: lastSessionExercises = getLastSessionExercises(allDays, dateKey);

  const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
    { value: 'barbell', label: 'Barbell' },
    { value: 'dumbbell', label: 'Dumbbell' },
    { value: 'cable', label: 'Cable' },
    { value: 'machine', label: 'Machine' },
  ];

  let draftWeight: Record<string, number> = {};
  let draftReps: Record<string, number> = {};
  let draftSeconds: Record<string, number> = {};
  let draftEquipment: Record<string, Equipment | undefined> = {};
  let addingExercise = false;
  let newExerciseName = '';

  // "Click again to confirm" delete pattern — arms for 3s, then auto-reverts.
  let confirmingExerciseId: string | null = null;
  let confirmExerciseTimeout: ReturnType<typeof setTimeout> | null = null;

  // The exercise catalog's own type decides what a set for it looks like —
  // never the type of any set already logged — so changing an exercise's
  // type in Settings only ever affects sets logged from that point on.
  function typeOf(exerciseId: string): ExerciseType {
    return exerciseById[exerciseId]?.type ?? 'weight';
  }

  function exerciseLabel(exerciseId: string): string {
    const exercise = exerciseById[exerciseId];
    if (!exercise) return 'Unknown exercise';
    const isWeightType = (exercise.type ?? 'weight') === 'weight';
    return isWeightType && exercise.singleArm ? `${exercise.name} · single-arm` : exercise.name;
  }

  function initDraftFor(exerciseId: string) {
    if (draftWeight[exerciseId] !== undefined) return;
    const last = getLastLoggedSet(allDays, exerciseId, dateKey);
    const lastWeight = last && 'weight' in last ? last.weight : undefined;
    const lastReps = last && 'reps' in last ? last.reps : undefined;
    const lastSeconds = last && 'seconds' in last ? last.seconds : undefined;
    const lastEquipment = last && 'equipment' in last ? last.equipment : undefined;
    draftWeight = { ...draftWeight, [exerciseId]: lastWeight ?? 20 };
    draftReps = { ...draftReps, [exerciseId]: lastReps ?? 8 };
    draftSeconds = { ...draftSeconds, [exerciseId]: lastSeconds ?? 30 };
    draftEquipment = { ...draftEquipment, [exerciseId]: lastEquipment };
  }

  onMount(() => {
    entries.forEach((e) => initDraftFor(e.exerciseId));
  });

  onDestroy(() => {
    if (confirmExerciseTimeout) clearTimeout(confirmExerciseTimeout);
  });

  function addExerciseToLog(exerciseId: string) {
    if (entries.some((e) => e.exerciseId === exerciseId)) return;
    entries = [...entries, { exerciseId, sets: [] }];
    initDraftFor(exerciseId);
  }

  function adjustWeight(exerciseId: string, delta: number) {
    const next = Math.max(0, (draftWeight[exerciseId] ?? 0) + delta);
    draftWeight = { ...draftWeight, [exerciseId]: next };
  }

  function adjustReps(exerciseId: string, delta: number) {
    const next = Math.max(1, (draftReps[exerciseId] ?? 1) + delta);
    draftReps = { ...draftReps, [exerciseId]: next };
  }

  function adjustSeconds(exerciseId: string, delta: number) {
    const next = Math.max(0, (draftSeconds[exerciseId] ?? 0) + delta);
    draftSeconds = { ...draftSeconds, [exerciseId]: next };
  }

  function toggleEquipment(exerciseId: string, equipment: Equipment) {
    const next = draftEquipment[exerciseId] === equipment ? undefined : equipment;
    draftEquipment = { ...draftEquipment, [exerciseId]: next };
  }

  function logSet(exerciseId: string) {
    const type = typeOf(exerciseId);
    let set: ExerciseSet;
    if (type === 'bodyweight') {
      set = { type: 'bodyweight', reps: draftReps[exerciseId] ?? 0 };
    } else if (type === 'time') {
      set = { type: 'time', seconds: draftSeconds[exerciseId] ?? 0 };
    } else {
      set = {
        type: 'weight',
        weight: draftWeight[exerciseId] ?? 0,
        reps: draftReps[exerciseId] ?? 0,
        equipment: draftEquipment[exerciseId],
      };
    }
    entries = entries.map((e) =>
      e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, set] } : e
    );
  }

  function removeSet(exerciseId: string, setIndex: number) {
    entries = entries.map((e) =>
      e.exerciseId === exerciseId ? { ...e, sets: e.sets.filter((_, i) => i !== setIndex) } : e
    );
  }

  function handleRemoveExerciseClick(exerciseId: string) {
    if (confirmingExerciseId === exerciseId) {
      if (confirmExerciseTimeout) clearTimeout(confirmExerciseTimeout);
      confirmingExerciseId = null;
      entries = entries.filter((e) => e.exerciseId !== exerciseId);
      return;
    }
    confirmingExerciseId = exerciseId;
    if (confirmExerciseTimeout) clearTimeout(confirmExerciseTimeout);
    confirmExerciseTimeout = setTimeout(() => { confirmingExerciseId = null; }, 3000);
  }

  function copyLastSession() {
    if (!lastSessionExercises) return;
    entries = lastSessionExercises.map((e) => ({ exerciseId: e.exerciseId, sets: [] }));
    entries.forEach((e) => initDraftFor(e.exerciseId));
  }

  async function commitNewExercise() {
    const name = newExerciseName.trim();
    if (!name) { addingExercise = false; return; }
    newExerciseName = '';
    addingExercise = false;
    try {
      const id = await addExercise(userId, name);
      addExerciseToLog(id);
    } catch {
      showError();
    }
  }

  function autofocus(el: HTMLInputElement) {
    el.focus();
  }
</script>

{#if entries.length === 0 && lastSessionExercises}
  <button
    type="button"
    on:click={copyLastSession}
    class="self-start text-sm text-gb-light-blue dark:text-gb-blue hover:text-gb-light-fg dark:hover:text-gb-fg transition"
  >Copy last session</button>
{/if}

{#if entries.length > 0}
  <div class="max-h-72 overflow-y-auto flex flex-col gap-2 pr-1">
    {#each entries as ex (ex.exerciseId)}
      {@const exType = typeOf(ex.exerciseId)}
      <div class="bg-gb-light-bg2 dark:bg-gb-bg2 border border-gb-light-bg3 dark:border-gb-bg3 p-3 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-semibold text-gb-light-fg dark:text-gb-fg">{exerciseLabel(ex.exerciseId)}</span>
          <button
            type="button"
            on:click={() => handleRemoveExerciseClick(ex.exerciseId)}
            aria-label={confirmingExerciseId === ex.exerciseId ? 'Confirm remove exercise' : 'Remove exercise'}
            class="text-xs font-medium px-2 py-1 transition-colors shrink-0
                   {confirmingExerciseId === ex.exerciseId ? 'text-white bg-gb-light-red dark:bg-gb-red' : 'text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-red dark:hover:text-gb-red'}"
          >{confirmingExerciseId === ex.exerciseId ? 'Confirm?' : '✕'}</button>
        </div>

        {#if ex.sets.length > 0}
          <div class="flex flex-wrap gap-1.5">
            {#each ex.sets as set, i}
              <button
                type="button"
                on:click={() => removeSet(ex.exerciseId, i)}
                class="text-xs px-2 py-1 bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-red dark:hover:border-gb-red hover:text-gb-light-red dark:hover:text-gb-red transition"
              >{formatSet(set)} ✕</button>
            {/each}
          </div>
        {/if}

        {#if exType === 'weight'}
          <div class="flex flex-wrap gap-1.5">
            {#each EQUIPMENT_OPTIONS as opt}
              <button
                type="button"
                on:click={() => toggleEquipment(ex.exerciseId, opt.value)}
                aria-pressed={draftEquipment[ex.exerciseId] === opt.value}
                class="px-2 py-1 text-xs border transition
                       {draftEquipment[ex.exerciseId] === opt.value
                         ? 'border-gb-light-green dark:border-gb-green text-gb-light-green dark:text-gb-green bg-gb-light-bg2 dark:bg-gb-bg2'
                         : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue'}"
              >{opt.label}</button>
            {/each}
          </div>
        {/if}

        <div class="flex items-center gap-2">
          {#if exType === 'weight'}
            <div class="flex items-center gap-1">
              <button
                type="button"
                use:holdRepeat={() => adjustWeight(ex.exerciseId, -2.5)}
                aria-label="Decrease weight"
                class="w-7 h-7 flex items-center justify-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-blue dark:hover:border-gb-blue transition select-none"
              >-</button>
              <span class="text-sm text-gb-light-fg dark:text-gb-fg w-14 text-center tabular-nums">{draftWeight[ex.exerciseId] ?? 0}kg</span>
              <button
                type="button"
                use:holdRepeat={() => adjustWeight(ex.exerciseId, 2.5)}
                aria-label="Increase weight"
                class="w-7 h-7 flex items-center justify-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-blue dark:hover:border-gb-blue transition select-none"
              >+</button>
            </div>
          {/if}
          {#if exType === 'weight' || exType === 'bodyweight'}
            <div class="flex items-center gap-1">
              <button
                type="button"
                use:holdRepeat={() => adjustReps(ex.exerciseId, -1)}
                aria-label="Decrease reps"
                class="w-7 h-7 flex items-center justify-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-blue dark:hover:border-gb-blue transition select-none"
              >-</button>
              <span class="text-sm text-gb-light-fg dark:text-gb-fg w-8 text-center tabular-nums">{draftReps[ex.exerciseId] ?? 0}</span>
              <button
                type="button"
                use:holdRepeat={() => adjustReps(ex.exerciseId, 1)}
                aria-label="Increase reps"
                class="w-7 h-7 flex items-center justify-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-blue dark:hover:border-gb-blue transition select-none"
              >+</button>
            </div>
          {/if}
          {#if exType === 'time'}
            <div class="flex items-center gap-1">
              <button
                type="button"
                use:holdRepeat={() => adjustSeconds(ex.exerciseId, -5)}
                aria-label="Decrease duration"
                class="w-7 h-7 flex items-center justify-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-blue dark:hover:border-gb-blue transition select-none"
              >-</button>
              <span class="text-sm text-gb-light-fg dark:text-gb-fg w-14 text-center tabular-nums">{draftSeconds[ex.exerciseId] ?? 0}s</span>
              <button
                type="button"
                use:holdRepeat={() => adjustSeconds(ex.exerciseId, 5)}
                aria-label="Increase duration"
                class="w-7 h-7 flex items-center justify-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-blue dark:hover:border-gb-blue transition select-none"
              >+</button>
            </div>
          {/if}
          <button
            type="button"
            on:click={() => logSet(ex.exerciseId)}
            class="flex-1 bg-gb-light-green dark:bg-gb-green text-gb-light-bg dark:text-gb-bg font-semibold text-sm px-3 py-1.5 hover:opacity-90 transition"
          >Log Set</button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<div class="flex flex-wrap gap-2">
  {#each pickableExercises as ex (ex.id)}
    <button
      type="button"
      on:click={() => addExerciseToLog(ex.id)}
      class="px-3 py-1 rounded-full border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 text-sm
             hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue transition"
    >+ {ex.name}</button>
  {/each}

  {#if addingExercise}
    <input
      type="text"
      bind:value={newExerciseName}
      placeholder="Type name…"
      on:keydown={(e) => e.key === 'Enter' && commitNewExercise()}
      on:blur={commitNewExercise}
      class="px-3 py-1 rounded-full border border-gb-light-bg3 dark:border-gb-bg3 bg-gb-light-bg2 dark:bg-gb-bg2 text-gb-light-fg dark:text-gb-fg
             text-sm focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
      use:autofocus
    />
  {:else}
    <button
      type="button"
      on:click={() => (addingExercise = true)}
      class="px-3 py-1 rounded-full border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 text-sm
             hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue transition"
    >+ Add exercise</button>
  {/if}
</div>
