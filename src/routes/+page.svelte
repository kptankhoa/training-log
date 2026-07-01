<script lang="ts">
  import { onMount } from 'svelte';
  import { user } from '$lib/stores/auth';
  import { tags, activeTags, tagsLoading, initTags } from '$lib/stores/tags';
  import { days, allDays, daysLoading, initDays } from '$lib/stores/days';
  import { activeTasks, initTasks } from '$lib/stores/tasks';
  import { computeStreaks } from '$lib/streaks';
  import Calendar from '$lib/components/Calendar.svelte';
  import DayModal from '$lib/components/DayModal.svelte';
  import Spinner from '$lib/components/Spinner.svelte';

  let selectedDate: string | null = null;
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth() + 1;

  let unsubTags: (() => void) | null = null;
  let unsubDays: (() => void) | null = null;
  let unsubTasks: (() => void) | null = null;

  $: userId = $user?.uid ?? '';

  onMount(() => {
    const unsubUser = user.subscribe((u) => {
      if (!u) return;
      unsubTags?.(); unsubTags = initTags(u.uid);
      unsubDays?.(); unsubDays = initDays(u.uid, viewYear, viewMonth);
      unsubTasks?.(); unsubTasks = initTasks(u.uid);
    });
    return () => {
      unsubUser();
      unsubTags?.();
      unsubDays?.();
      unsubTasks?.();
    };
  });

  function resubscribeDays() {
    if (userId) { unsubDays?.(); unsubDays = initDays(userId, viewYear, viewMonth); }
  }

  function prevMonth() {
    if (viewMonth === 1) { viewMonth = 12; viewYear -= 1; }
    else viewMonth -= 1;
    resubscribeDays();
  }

  function nextMonth() {
    if (viewMonth === 12) { viewMonth = 1; viewYear += 1; }
    else viewMonth += 1;
    resubscribeDays();
  }

  $: selectedEntry = selectedDate
    ? ($days[selectedDate] ?? { tags: [], label: '', note: '', tasks: [], photos: [] })
    : null;

  $: streaks = computeStreaks($allDays);
</script>

<div class="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-4">
  {#if $tagsLoading || $daysLoading}
    <Spinner />
  {:else}
    <Calendar
      year={viewYear}
      month={viewMonth}
      days={$days}
      tags={$tags}
      on:selectDay={(e) => (selectedDate = e.detail)}
      on:prevMonth={prevMonth}
      on:nextMonth={nextMonth}
    />

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
  {/if}
</div>

{#if selectedDate && selectedEntry && userId}
  <DayModal
    dateKey={selectedDate}
    entry={selectedEntry}
    activeTags={$activeTags}
    activeTasks={$activeTasks}
    {userId}
    on:close={() => (selectedDate = null)}
  />
{/if}
