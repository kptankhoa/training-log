<script lang="ts">
  import { user } from '$lib/stores/auth';
  import { activeTags, tagsLoading } from '$lib/stores/tags';
  import { allDays, daysLoading } from '$lib/stores/days';
  import { activeTasks } from '$lib/stores/tasks';
  import { exercises } from '$lib/stores/exercises';
  import { notes } from '$lib/stores/notes';
  import { computeStreaks } from '$lib/streaks';
  import DayDetail from '$lib/components/DayDetail.svelte';
  import Spinner from '$lib/components/Spinner.svelte';

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
    <p class="text-gb-fg3 text-xs uppercase tracking-wider">Today</p>
    <h1 class="text-gb-green text-xl font-bold glow-green">{heading}</h1>
  </div>

  {#if $tagsLoading || $daysLoading}
    <Spinner />
  {:else}
    <div class="flex items-center gap-6 px-1 text-sm">
      <div class="flex items-center gap-2">
        <span class="text-gb-green font-semibold glow-green">{streaks.current}</span>
        <span class="text-gb-fg3">day{streaks.current !== 1 ? 's' : ''} current streak</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-gb-orange font-semibold">{streaks.longest}</span>
        <span class="text-gb-fg3">longest streak</span>
      </div>
    </div>

    {#if userId}
      <DayDetail
        dateKey={todayKey}
        {entry}
        activeTags={$activeTags}
        activeTasks={$activeTasks}
        exercises={$exercises}
        splits={$notes}
        allDays={$allDays}
        {userId}
        hideOtherSectionsWhileEditingNote={false}
      />
    {/if}
  {/if}
</div>
