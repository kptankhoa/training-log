<script lang="ts">
  import { onMount } from 'svelte';
  import { user } from '$lib/stores/auth';
  import { tags, activeTags, initTags } from '$lib/stores/tags';
  import { days, initDays } from '$lib/stores/days';
  import Calendar from '$lib/components/Calendar.svelte';
  import DayModal from '$lib/components/DayModal.svelte';

  let selectedDate: string | null = null;
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth() + 1;

  let unsubTags: (() => void) | null = null;
  let unsubDays: (() => void) | null = null;

  $: userId = $user?.uid ?? '';

  onMount(() => {
    const unsubUser = user.subscribe((u) => {
      if (!u) return;
      unsubTags?.(); unsubTags = initTags(u.uid);
      unsubDays?.(); unsubDays = initDays(u.uid, viewYear, viewMonth);
    });
    return () => {
      unsubUser();
      unsubTags?.();
      unsubDays?.();
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
    ? ($days[selectedDate] ?? { tags: [], label: '', note: '' })
    : null;
</script>

<div class="p-4 md:p-8 max-w-3xl mx-auto">
  <Calendar
    year={viewYear}
    month={viewMonth}
    days={$days}
    tags={$tags}
    on:selectDay={(e) => (selectedDate = e.detail)}
    on:prevMonth={prevMonth}
    on:nextMonth={nextMonth}
  />
</div>

{#if selectedDate && selectedEntry && userId}
  <DayModal
    dateKey={selectedDate}
    entry={selectedEntry}
    activeTags={$activeTags}
    {userId}
    on:close={() => (selectedDate = null)}
  />
{/if}
