<script lang="ts">
  import { slide } from 'svelte/transition';
  import { user, signOut } from '$lib/stores/auth';
  import { icons } from '$lib/icons';
  import { activeTags, tagsLoading, addTag, deleteTag, updateTagColor } from '$lib/stores/tags';
  import { activeTasks, tasksLoading, addTask, deleteTask } from '$lib/stores/tasks';
  import { activeExercises, exercisesLoading, addExercise, deleteExercise, updateExerciseSplits } from '$lib/stores/exercises';
  import { splits } from '$lib/stores/splits';
  import { theme, setTheme } from '$lib/stores/theme';
  import { restTimerSound, setRestTimerSound, playRestTimerSound, SOUND_OPTIONS, type RestTimerSound } from '$lib/stores/restTimerSound';
  import { gruvboxColors, COLOR_ORDER } from '$lib/gruvbox';
  import { navColorClasses, navBorderClass, navTextClass } from '$lib/navColors';
  import Spinner from '$lib/components/shared/Spinner.svelte';
  import type { Exercise, GruvboxColor } from '$lib/types';

  $: userId = $user?.uid ?? '';

  // Section accordions — start collapsed so the page loads short.
  let tagsExpanded = false;
  let tasksExpanded = false;
  let exercisesExpanded = false;
  let restTimerSoundExpanded = false;

  let expandedExerciseId: string | null = null;

  function toggleExerciseExpand(exerciseId: string) {
    expandedExerciseId = expandedExerciseId === exerciseId ? null : exerciseId;
  }

  async function toggleExerciseSplit(exercise: Exercise, splitId: string) {
    const current = exercise.splitIds ?? [];
    const next = current.includes(splitId) ? current.filter((id) => id !== splitId) : [...current, splitId];
    await updateExerciseSplits(userId, exercise.id, next);
  }

  let newTagName = '';
  let newTaskName = '';
  let newExerciseName = '';

  // "Click again to confirm" delete pattern — arms for 3s, then auto-reverts.
  let confirmingTagId: string | null = null;
  let confirmingTaskId: string | null = null;
  let confirmingExerciseId: string | null = null;
  let confirmTagTimeout: ReturnType<typeof setTimeout> | null = null;
  let confirmTaskTimeout: ReturnType<typeof setTimeout> | null = null;
  let confirmExerciseTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleDeleteTagClick(tagId: string) {
    if (confirmingTagId === tagId) {
      if (confirmTagTimeout) clearTimeout(confirmTagTimeout);
      confirmingTagId = null;
      deleteTag(userId, tagId);
      return;
    }
    confirmingTagId = tagId;
    if (confirmTagTimeout) clearTimeout(confirmTagTimeout);
    confirmTagTimeout = setTimeout(() => { confirmingTagId = null; }, 3000);
  }

  function handleDeleteTaskClick(taskId: string) {
    if (confirmingTaskId === taskId) {
      if (confirmTaskTimeout) clearTimeout(confirmTaskTimeout);
      confirmingTaskId = null;
      deleteTask(userId, taskId);
      return;
    }
    confirmingTaskId = taskId;
    if (confirmTaskTimeout) clearTimeout(confirmTaskTimeout);
    confirmTaskTimeout = setTimeout(() => { confirmingTaskId = null; }, 3000);
  }

  function handleDeleteExerciseClick(exerciseId: string) {
    if (confirmingExerciseId === exerciseId) {
      if (confirmExerciseTimeout) clearTimeout(confirmExerciseTimeout);
      confirmingExerciseId = null;
      deleteExercise(userId, exerciseId);
      return;
    }
    confirmingExerciseId = exerciseId;
    if (confirmExerciseTimeout) clearTimeout(confirmExerciseTimeout);
    confirmExerciseTimeout = setTimeout(() => { confirmingExerciseId = null; }, 3000);
  }

  async function handleAdd() {
    const name = newTagName.trim();
    if (!name) return;
    newTagName = '';
    await addTag(userId, name);
  }

  async function handleAddTask() {
    const name = newTaskName.trim();
    if (!name) return;
    newTaskName = '';
    await addTask(userId, name);
  }

  async function handleAddExercise() {
    const name = newExerciseName.trim();
    if (!name) return;
    newExerciseName = '';
    await addExercise(userId, name);
  }

  function cycleColor(tagId: string, current: GruvboxColor) {
    const next = COLOR_ORDER[(COLOR_ORDER.indexOf(current) + 1) % COLOR_ORDER.length];
    updateTagColor(userId, tagId, next);
  }

  async function handleSetTheme(value: 'dark' | 'light') {
    if (!userId) return;
    await setTheme(userId, value);
  }

  function handleSelectRestTimerSound(value: RestTimerSound) {
    playRestTimerSound(value); // preview immediately so picking a sound is self-explanatory
    if (userId) setRestTimerSound(userId, value);
  }
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-10">
  <h1 class="text-2xl font-bold {navColorClasses('/settings')}">Settings</h1>

  <section class="flex flex-col gap-4">
    <button
      type="button"
      on:click={() => (tagsExpanded = !tagsExpanded)}
      class="flex items-center justify-between w-full text-left text-gb-light-fg dark:text-gb-fg font-semibold border-b border-gb-light-bg2 dark:border-gb-bg2 pb-2"
    >
      <span>Training Types</span>
      <span class="text-sm leading-none">{tagsExpanded ? '-' : '+'}</span>
    </button>

    {#if tagsExpanded}
      <div class="flex flex-col gap-4" transition:slide={{ duration: 200 }}>
        {#if $tagsLoading}
          <Spinner />
        {:else}
          <ul class="flex flex-col gap-2">
            {#each $activeTags as tag (tag.id)}
              <li class="flex items-center gap-3 bg-gb-light-bg1 dark:bg-gb-bg1 px-4 py-3">
                <button
                  type="button"
                  on:click={() => cycleColor(tag.id, tag.color)}
                  style="background-color: {$gruvboxColors[tag.color]}"
                  class="w-5 h-5 shrink-0 border-2 border-gb-light-bg3 dark:border-gb-bg3 hover:scale-110 transition-transform"
                  title="Click to change color"
                ></button>
                <span class="flex-1 text-gb-light-fg dark:text-gb-fg text-sm">{tag.name}</span>
                <button
                  type="button"
                  on:click={() => handleDeleteTagClick(tag.id)}
                  aria-label={confirmingTagId === tag.id ? `Confirm delete ${tag.name}` : `Delete ${tag.name}`}
                  class="text-xs font-medium px-2 py-1 transition-colors shrink-0
                         {confirmingTagId === tag.id ? 'text-white bg-gb-light-red dark:bg-gb-red' : 'text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-red dark:hover:text-gb-red'}"
                >{confirmingTagId === tag.id ? 'Confirm?' : '✕'}</button>
              </li>
            {/each}
          </ul>
        {/if}

        <div class="flex gap-2">
          <input
            type="text"
            bind:value={newTagName}
            placeholder="New training type"
            on:keydown={(e) => e.key === 'Enter' && handleAdd()}
            class="flex-1 bg-gb-light-bg1 dark:bg-gb-bg1 text-gb-light-fg dark:text-gb-fg text-sm px-3 py-2
                   border border-gb-light-bg2 dark:border-gb-bg2 focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
          />
          <button
            type="button"
            on:click={handleAdd}
            class="bg-gb-light-blue dark:bg-gb-blue text-gb-light-bg dark:text-gb-bg font-semibold px-4 py-2 hover:opacity-90 transition text-sm"
          >Add</button>
        </div>
      </div>
    {/if}
  </section>

  <section class="flex flex-col gap-4">
    <button
      type="button"
      on:click={() => (tasksExpanded = !tasksExpanded)}
      class="flex items-center justify-between w-full text-left text-gb-light-fg dark:text-gb-fg font-semibold border-b border-gb-light-bg2 dark:border-gb-bg2 pb-2"
    >
      <span>Daily Tasks</span>
      <span class="text-sm leading-none">{tasksExpanded ? '-' : '+'}</span>
    </button>

    {#if tasksExpanded}
      <div class="flex flex-col gap-4" transition:slide={{ duration: 200 }}>
        {#if $tasksLoading}
          <Spinner />
        {:else}
          <ul class="flex flex-col gap-2">
            {#each $activeTasks as task (task.id)}
              <li class="flex items-center gap-3 bg-gb-light-bg1 dark:bg-gb-bg1 px-4 py-3">
                <span class="flex-1 text-gb-light-fg dark:text-gb-fg text-sm">{task.name}</span>
                <button
                  type="button"
                  on:click={() => handleDeleteTaskClick(task.id)}
                  aria-label={confirmingTaskId === task.id ? `Confirm delete ${task.name}` : `Delete ${task.name}`}
                  class="text-xs font-medium px-2 py-1 transition-colors shrink-0
                         {confirmingTaskId === task.id ? 'text-white bg-gb-light-red dark:bg-gb-red' : 'text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-red dark:hover:text-gb-red'}"
                >{confirmingTaskId === task.id ? 'Confirm?' : '✕'}</button>
              </li>
            {/each}
          </ul>
        {/if}

        <div class="flex gap-2">
          <input
            type="text"
            bind:value={newTaskName}
            placeholder="New daily task"
            on:keydown={(e) => e.key === 'Enter' && handleAddTask()}
            class="flex-1 bg-gb-light-bg1 dark:bg-gb-bg1 text-gb-light-fg dark:text-gb-fg text-sm px-3 py-2
                   border border-gb-light-bg2 dark:border-gb-bg2 focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
          />
          <button
            type="button"
            on:click={handleAddTask}
            class="bg-gb-light-blue dark:bg-gb-blue text-gb-light-bg dark:text-gb-bg font-semibold px-4 py-2 hover:opacity-90 transition text-sm"
          >Add</button>
        </div>
      </div>
    {/if}
  </section>

  <section class="flex flex-col gap-4">
    <button
      type="button"
      on:click={() => (exercisesExpanded = !exercisesExpanded)}
      class="flex items-center justify-between w-full text-left text-gb-light-fg dark:text-gb-fg font-semibold border-b border-gb-light-bg2 dark:border-gb-bg2 pb-2"
    >
      <span>Exercises</span>
      <span class="text-sm leading-none">{exercisesExpanded ? '-' : '+'}</span>
    </button>

    {#if exercisesExpanded}
      <div class="flex flex-col gap-4" transition:slide={{ duration: 200 }}>
        {#if $exercisesLoading}
          <Spinner />
        {:else}
          <ul class="max-h-96 overflow-y-auto flex flex-col gap-2 pr-1">
            {#each $activeExercises as exercise (exercise.id)}
              <li class="flex flex-col bg-gb-light-bg1 dark:bg-gb-bg1">
                <div class="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    on:click={() => toggleExerciseExpand(exercise.id)}
                    class="flex-1 text-left text-gb-light-fg dark:text-gb-fg text-sm"
                  >
                    {exercise.name}
                    {#if exercise.splitIds?.length}
                      <span class="text-gb-light-fg3 dark:text-gb-fg3 text-xs"> · {exercise.splitIds.length} split{exercise.splitIds.length !== 1 ? 's' : ''}</span>
                    {/if}
                  </button>
                  <button
                    type="button"
                    on:click={() => handleDeleteExerciseClick(exercise.id)}
                    aria-label={confirmingExerciseId === exercise.id ? `Confirm delete ${exercise.name}` : `Delete ${exercise.name}`}
                    class="text-xs font-medium px-2 py-1 transition-colors shrink-0
                           {confirmingExerciseId === exercise.id ? 'text-white bg-gb-light-red dark:bg-gb-red' : 'text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-red dark:hover:text-gb-red'}"
                  >{confirmingExerciseId === exercise.id ? 'Confirm?' : '✕'}</button>
                </div>
                {#if expandedExerciseId === exercise.id}
                  <div class="px-4 pb-3 flex flex-col gap-2">
                    <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Tied to splits (none = always available)</span>
                    {#if $splits.length === 0}
                      <p class="text-gb-light-fg3 dark:text-gb-fg3 text-xs italic">No splits yet — add one in Split Design.</p>
                    {:else}
                      <div class="flex flex-wrap gap-2">
                        {#each $splits as split (split.id)}
                          <button
                            type="button"
                            on:click={() => toggleExerciseSplit(exercise, split.id)}
                            class="px-3 py-1 text-xs border transition
                                   {(exercise.splitIds ?? []).includes(split.id)
                                     ? 'border-gb-light-green dark:border-gb-green text-gb-light-green dark:text-gb-green bg-gb-light-bg2 dark:bg-gb-bg2'
                                     : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue'}"
                          >{split.label || 'Untitled'}</button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}

        <div class="flex gap-2">
          <input
            type="text"
            bind:value={newExerciseName}
            placeholder="New exercise"
            on:keydown={(e) => e.key === 'Enter' && handleAddExercise()}
            class="flex-1 bg-gb-light-bg1 dark:bg-gb-bg1 text-gb-light-fg dark:text-gb-fg text-sm px-3 py-2
                   border border-gb-light-bg2 dark:border-gb-bg2 focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
          />
          <button
            type="button"
            on:click={handleAddExercise}
            class="bg-gb-light-blue dark:bg-gb-blue text-gb-light-bg dark:text-gb-bg font-semibold px-4 py-2 hover:opacity-90 transition text-sm"
          >Add</button>
        </div>
      </div>
    {/if}
  </section>

  <section class="flex flex-col gap-4">
    <button
      type="button"
      on:click={() => (restTimerSoundExpanded = !restTimerSoundExpanded)}
      class="flex items-center justify-between w-full text-left text-gb-light-fg dark:text-gb-fg font-semibold border-b border-gb-light-bg2 dark:border-gb-bg2 pb-2"
    >
      <span>Rest Timer Sound</span>
      <span class="text-sm leading-none">{restTimerSoundExpanded ? '-' : '+'}</span>
    </button>

    {#if restTimerSoundExpanded}
      <div class="flex gap-2" transition:slide={{ duration: 200 }}>
        {#each SOUND_OPTIONS as opt}
          <button
            type="button"
            on:click={() => handleSelectRestTimerSound(opt.value)}
            aria-label="Preview and select sound {opt.label}"
            aria-pressed={$restTimerSound === opt.value}
            class="px-4 py-2 text-sm border transition
                   {$restTimerSound === opt.value
                     ? 'border-gb-light-green dark:border-gb-green text-gb-light-green dark:text-gb-green bg-gb-light-bg2 dark:bg-gb-bg2'
                     : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 hover:border-gb-light-blue hover:text-gb-light-blue dark:hover:border-gb-blue dark:hover:text-gb-blue'}"
          >{opt.label}</button>
        {/each}
      </div>
    {/if}
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="text-gb-light-fg dark:text-gb-fg font-semibold border-b border-gb-light-bg2 dark:border-gb-bg2 pb-2">Appearance</h2>
    <div class="flex gap-2">
      <button
        type="button"
        on:click={() => handleSetTheme('dark')}
        class="px-4 py-2 text-sm border transition
               {$theme === 'dark'
                 ? `${navBorderClass('/settings')} ${navTextClass('/settings')} bg-gb-light-bg2 dark:bg-gb-bg2`
                 : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 hover:border-gb-light-blue hover:text-gb-light-blue dark:hover:border-gb-blue dark:hover:text-gb-blue'}"
      >Dark</button>
      <button
        type="button"
        on:click={() => handleSetTheme('light')}
        class="px-4 py-2 text-sm border transition
               {$theme === 'light'
                 ? `${navBorderClass('/settings')} ${navTextClass('/settings')} bg-gb-light-bg2 dark:bg-gb-bg2`
                 : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 hover:border-gb-light-blue hover:text-gb-light-blue dark:hover:border-gb-blue dark:hover:text-gb-blue'}"
      >Light</button>
    </div>
  </section>

  <section class="md:hidden flex flex-col gap-2">
    <h2 class="text-gb-light-fg dark:text-gb-fg font-semibold border-b border-gb-light-bg2 dark:border-gb-bg2 pb-2">Account</h2>
    <button
      type="button"
      on:click={signOut}
      class="flex items-center gap-3 px-4 py-3 bg-gb-light-bg1 dark:bg-gb-bg1 text-gb-light-fg3 dark:text-gb-fg3
             hover:text-gb-light-red dark:hover:text-gb-red hover:bg-gb-light-bg2 dark:hover:bg-gb-bg2 transition-colors text-sm w-full text-left"
    >
      {@html icons.signOutSm}
      Sign out
    </button>
  </section>
</div>
