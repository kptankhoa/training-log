<script lang="ts">
  import { onMount } from 'svelte';
  import { user, signOut } from '$lib/stores/auth';
  import { icons } from '$lib/icons';
  import { activeTags, tagsLoading, addTag, deleteTag, updateTagColor, initTags } from '$lib/stores/tags';
  import { activeTasks, tasksLoading, addTask, deleteTask, initTasks } from '$lib/stores/tasks';
  import { activeExercises, exercisesLoading, addExercise, deleteExercise, initExercises } from '$lib/stores/exercises';
  import { GRUVBOX_COLORS, COLOR_ORDER } from '$lib/gruvbox';
  import Spinner from '$lib/components/Spinner.svelte';
  import type { GruvboxColor } from '$lib/types';

  $: userId = $user?.uid ?? '';

  let unsubTags: (() => void) | null = null;
  let unsubTasks: (() => void) | null = null;
  let unsubExercises: (() => void) | null = null;

  onMount(() => {
    const unsubUser = user.subscribe((u) => {
      if (!u) return;
      unsubTags?.(); unsubTags = initTags(u.uid);
      unsubTasks?.(); unsubTasks = initTasks(u.uid);
      unsubExercises?.(); unsubExercises = initExercises(u.uid);
    });
    return () => { unsubUser(); unsubTags?.(); unsubTasks?.(); unsubExercises?.(); };
  });

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
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-10">
  <h1 class="text-gb-green text-2xl font-bold glow-green">Settings</h1>

  <section class="flex flex-col gap-4">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2">Training Types</h2>

    {#if $tagsLoading}
      <Spinner />
    {:else}
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
              on:click={() => handleDeleteTagClick(tag.id)}
              aria-label={confirmingTagId === tag.id ? `Confirm delete ${tag.name}` : `Delete ${tag.name}`}
              class="text-xs font-medium px-2 py-1 transition-colors shrink-0
                     {confirmingTagId === tag.id ? 'text-white bg-gb-red' : 'text-gb-fg3 hover:text-gb-red'}"
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

  <section class="flex flex-col gap-4">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2">Daily Tasks</h2>

    {#if $tasksLoading}
      <Spinner />
    {:else}
      <ul class="flex flex-col gap-2">
        {#each $activeTasks as task (task.id)}
          <li class="flex items-center gap-3 bg-gb-bg1 px-4 py-3">
            <span class="flex-1 text-gb-fg text-sm">{task.name}</span>
            <button
              type="button"
              on:click={() => handleDeleteTaskClick(task.id)}
              aria-label={confirmingTaskId === task.id ? `Confirm delete ${task.name}` : `Delete ${task.name}`}
              class="text-xs font-medium px-2 py-1 transition-colors shrink-0
                     {confirmingTaskId === task.id ? 'text-white bg-gb-red' : 'text-gb-fg3 hover:text-gb-red'}"
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
        class="flex-1 bg-gb-bg1 text-gb-fg text-sm px-3 py-2
               border border-gb-bg2 focus:outline-none focus:border-gb-blue"
      />
      <button
        type="button"
        on:click={handleAddTask}
        class="bg-gb-blue text-gb-bg font-semibold px-4 py-2 hover:opacity-90 transition text-sm"
      >Add</button>
    </div>
  </section>

  <section class="flex flex-col gap-4">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2">Exercises</h2>

    {#if $exercisesLoading}
      <Spinner />
    {:else}
      <ul class="flex flex-col gap-2">
        {#each $activeExercises as exercise (exercise.id)}
          <li class="flex items-center gap-3 bg-gb-bg1 px-4 py-3">
            <span class="flex-1 text-gb-fg text-sm">{exercise.name}</span>
            <button
              type="button"
              on:click={() => handleDeleteExerciseClick(exercise.id)}
              aria-label={confirmingExerciseId === exercise.id ? `Confirm delete ${exercise.name}` : `Delete ${exercise.name}`}
              class="text-xs font-medium px-2 py-1 transition-colors shrink-0
                     {confirmingExerciseId === exercise.id ? 'text-white bg-gb-red' : 'text-gb-fg3 hover:text-gb-red'}"
            >{confirmingExerciseId === exercise.id ? 'Confirm?' : '✕'}</button>
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
        class="flex-1 bg-gb-bg1 text-gb-fg text-sm px-3 py-2
               border border-gb-bg2 focus:outline-none focus:border-gb-blue"
      />
      <button
        type="button"
        on:click={handleAddExercise}
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
