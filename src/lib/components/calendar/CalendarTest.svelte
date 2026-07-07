<script lang="ts">
  import Calendar from './Calendar.svelte';
  import type { TrainingTag, DayEntry } from '$lib/types';

  export let year: number;
  export let month: number;
  export let days: Record<string, DayEntry> = {};
  export let tags: TrainingTag[] = [];

  let viewYear = year;
  let viewMonth = month;

  let selectDayEvents: string[] = [];
  let prevMonthCount = 0;
  let nextMonthCount = 0;

  function handlePrevMonth() {
    prevMonthCount += 1;
    if (viewMonth === 1) { viewMonth = 12; viewYear -= 1; }
    else viewMonth -= 1;
  }

  function handleNextMonth() {
    nextMonthCount += 1;
    if (viewMonth === 12) { viewMonth = 1; viewYear += 1; }
    else viewMonth += 1;
  }
</script>

<Calendar
  year={viewYear}
  month={viewMonth}
  {days}
  {tags}
  on:selectDay={(e) => (selectDayEvents = [...selectDayEvents, e.detail])}
  on:prevMonth={handlePrevMonth}
  on:nextMonth={handleNextMonth}
/>

<div data-testid="events">
  <div data-testid="select-day-count">{selectDayEvents.length}</div>
  <div data-testid="select-day-last">{selectDayEvents[selectDayEvents.length - 1] ?? 'none'}</div>
  <div data-testid="prev-month-count">{prevMonthCount}</div>
  <div data-testid="next-month-count">{nextMonthCount}</div>
</div>
