<script lang="ts">
  import { user } from '$lib/stores/auth';
  import { activeTags, tagsLoading } from '$lib/stores/tags';
  import { allDays, daysLoading } from '$lib/stores/days';
  import { activeTasks } from '$lib/stores/tasks';
  import { exercises } from '$lib/stores/exercises';
  import { splits } from '$lib/stores/splits';
  import { computeStreaks } from '$lib/streaks';
  import DayDetail from '$lib/components/day-detail/DayDetail.svelte';
  import Spinner from '$lib/components/shared/Spinner.svelte';
  import { navColorClasses } from '$lib/navColors';

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const heading = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  $: userId = $user?.uid ?? '';

  $: entry = $allDays[todayKey] ?? { tags: [], label: '', note: '', tasks: [], photos: [] };
  $: streaks = computeStreaks($allDays);
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-5">
  <div>
    <p class="text-gb-light-fg3 dark:text-gb-fg3 text-xs uppercase tracking-wider">Today</p>
    <h1 class="text-xl font-bold {navColorClasses('/')}">{heading}</h1>
  </div>

  {#if $tagsLoading || $daysLoading}
    <Spinner />
  {:else}
    <div class="flex items-end gap-8 px-1">
      <div class="flex flex-col">
        <span class="text-5xl font-bold leading-none tabular-nums text-gb-light-green dark:text-gb-green glow-green">{streaks.current}</span>
        <span class="text-gb-light-fg3 dark:text-gb-fg3 text-xs uppercase tracking-wider mt-1.5">day{streaks.current !== 1 ? 's' : ''} streak</span>
      </div>
      <div class="flex flex-col pb-0.5">
        <span class="text-2xl font-semibold leading-none tabular-nums text-gb-light-orange dark:text-gb-orange">{streaks.longest}</span>
        <span class="text-gb-light-fg3 dark:text-gb-fg3 text-xs uppercase tracking-wider mt-1.5">longest</span>
      </div>
    </div>

    {#if userId}
      <DayDetail
        dateKey={todayKey}
        {entry}
        activeTags={$activeTags}
        activeTasks={$activeTasks}
        exercises={$exercises}
        splits={$splits}
        allDays={$allDays}
        {userId}
        hideOtherSectionsWhileEditingNote={false}
      />
    {/if}
  {/if}
</div>
