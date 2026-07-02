<script lang="ts">
  import { user } from '$lib/stores/auth';
  import { tags, activeTags, tagsLoading } from '$lib/stores/tags';
  import { allDays, daysLoading, filterDaysByMonth } from '$lib/stores/days';
  import { activeTasks } from '$lib/stores/tasks';
  import { exercises } from '$lib/stores/exercises';
  import { splits } from '$lib/stores/splits';
  import { computeStreaks } from '$lib/streaks';
  import Calendar from '$lib/components/calendar/Calendar.svelte';
  import DayModal from '$lib/components/day-detail/DayModal.svelte';
  import Spinner from '$lib/components/shared/Spinner.svelte';

  let selectedDate: string | null = null;
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth() + 1;

  $: userId = $user?.uid ?? '';

  function prevMonth() {
    if (viewMonth === 1) { viewMonth = 12; viewYear -= 1; }
    else viewMonth -= 1;
  }

  function nextMonth() {
    if (viewMonth === 12) { viewMonth = 1; viewYear += 1; }
    else viewMonth += 1;
  }

  $: monthDays = filterDaysByMonth($allDays, viewYear, viewMonth);

  $: selectedEntry = selectedDate
    ? ($allDays[selectedDate] ?? { tags: [], label: '', note: '', tasks: [], photos: [] })
    : null;

  $: streaks = computeStreaks($allDays);
</script>

<div class="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-3">
  {#if $tagsLoading || $daysLoading}
    <Spinner />
  {:else}
    <Calendar
      year={viewYear}
      month={viewMonth}
      days={monthDays}
      tags={$tags}
      splits={$splits}
      on:selectDay={(e) => (selectedDate = e.detail)}
      on:prevMonth={prevMonth}
      on:nextMonth={nextMonth}
    />

    <div class="flex items-center gap-6 px-1 text-sm">
      <div class="flex items-center gap-2">
        <span class="text-gb-light-green dark:text-gb-green font-semibold glow-green">{streaks.current}</span>
        <span class="text-gb-light-fg3 dark:text-gb-fg3">day{streaks.current !== 1 ? 's' : ''} current streak</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-gb-light-orange dark:text-gb-orange font-semibold">{streaks.longest}</span>
        <span class="text-gb-light-fg3 dark:text-gb-fg3">longest streak</span>
      </div>
    </div>
  {/if}
</div>

{#if selectedDate && selectedEntry && userId}
  <DayModal
    dateKey={selectedDate}
    entry={selectedEntry}
    activeTags={$activeTags}
    activeTasks={$activeTasks}
    exercises={$exercises}
    splits={$splits}
    allDays={$allDays}
    {userId}
    on:close={() => (selectedDate = null)}
  />
{/if}
