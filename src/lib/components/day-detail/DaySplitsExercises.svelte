<script lang="ts">
  import { slide } from 'svelte/transition';
  import ExerciseEditor from './ExerciseEditor.svelte';
  import { gruvboxColors } from '$lib/gruvbox';
  import { formatSet } from '$lib/types';
  import type { Exercise, ExerciseEntry, Split, DayEntry } from '$lib/types';

  export let splits: Split[];
  export let exercises: Exercise[] = [];
  export let allDays: Record<string, DayEntry> = {};
  export let dateKey: string = '';
  export let userId: string = '';
  export let selectedSplitIds: Set<string>;
  export let exerciseEntries: ExerciseEntry[];
  export let readonly: boolean = false;
  export let noteEditing: boolean = false;

  $: selectedSplitList = splits.filter((s) => selectedSplitIds.has(s.id));
  $: exerciseNameById = Object.fromEntries(exercises.map((e) => [e.id, e.name]));

  function toggleSplit(splitId: string) {
    if (selectedSplitIds.has(splitId)) selectedSplitIds.delete(splitId);
    else selectedSplitIds.add(splitId);
    selectedSplitIds = selectedSplitIds;
  }

  // Not every day has a split/exercise logged — start collapsed unless there's
  // already something there, so an empty day's edit form isn't so tall.
  let splitsExpanded = selectedSplitIds.size > 0 || exerciseEntries.length > 0;
</script>

{#if readonly}
  {#if selectedSplitList.length > 0}
    <div class="flex flex-col gap-1.5">
      <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Splits</span>
      <div class="flex flex-wrap gap-3">
        {#each selectedSplitList as split (split.id)}
          <span class="flex items-center gap-1.5 text-sm text-gb-light-fg dark:text-gb-fg">
            <span class="w-2.5 h-2.5 shrink-0" style="background-color:{$gruvboxColors[split.color ?? 'blue']}"></span>
            {split.label || 'Untitled'}
          </span>
        {/each}
      </div>
    </div>
  {/if}

  {#if exerciseEntries.length > 0}
    <div class="flex flex-col gap-1.5">
      <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Exercises</span>
      <div class="flex flex-col gap-1">
        {#each exerciseEntries as ex (ex.exerciseId)}
          <p class="text-sm text-gb-light-fg dark:text-gb-fg">
            <span class="font-medium">{exerciseNameById[ex.exerciseId] ?? 'Unknown exercise'}</span>
            {#if ex.sets.length > 0}
              <span class="text-gb-light-fg3 dark:text-gb-fg3"> — {ex.sets.map(formatSet).join(', ')}</span>
            {:else}
              <span class="text-gb-light-fg3 dark:text-gb-fg3 italic"> — no sets logged</span>
            {/if}
          </p>
        {/each}
      </div>
    </div>
  {/if}
{:else}
  <div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-2">
    <button
      type="button"
      on:click={() => (splitsExpanded = !splitsExpanded)}
      class="flex items-center justify-between text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider"
    >
      <span>Splits & Exercises</span>
      <span class="text-sm leading-none">{splitsExpanded ? '-' : '+'}</span>
    </button>
    {#if splitsExpanded}
      <div class="flex flex-col gap-3" transition:slide={{ duration: 200 }}>
        <div class="flex flex-col gap-2">
          <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Splits</span>
          <div class="flex flex-wrap gap-2">
            {#each splits as split (split.id)}
              <button
                type="button"
                on:click={() => toggleSplit(split.id)}
                class="px-3 py-1 rounded-full border text-sm transition
                       {selectedSplitIds.has(split.id)
                         ? 'border-gb-light-green dark:border-gb-green text-gb-light-green dark:text-gb-green bg-gb-light-bg2 dark:bg-gb-bg2'
                         : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue'}"
              >{split.label || 'Untitled'}</button>
            {/each}
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Exercises</span>
          <ExerciseEditor {exercises} {allDays} {dateKey} {userId} daySplitIds={[...selectedSplitIds]} bind:entries={exerciseEntries} />
        </div>
      </div>
    {/if}
  </div>
{/if}
