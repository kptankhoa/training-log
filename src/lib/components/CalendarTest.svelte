<script lang="ts">
  import Calendar from './Calendar.svelte';
  import type { TrainingTag, DayEntry } from '$lib/types';

  export let year: number;
  export let month: number;
  export let days: Record<string, DayEntry> = {};
  export let tags: TrainingTag[] = [];

  let selectDayEvents: string[] = [];
  let prevMonthCount = 0;
  let nextMonthCount = 0;
</script>

<Calendar
  {year}
  {month}
  {days}
  {tags}
  on:selectDay={(e) => (selectDayEvents = [...selectDayEvents, e.detail])}
  on:prevMonth={() => (prevMonthCount += 1)}
  on:nextMonth={() => (nextMonthCount += 1)}
/>

<div data-testid="events">
  <div data-testid="select-day-count">{selectDayEvents.length}</div>
  <div data-testid="select-day-last">{selectDayEvents[selectDayEvents.length - 1] ?? 'none'}</div>
  <div data-testid="prev-month-count">{prevMonthCount}</div>
  <div data-testid="next-month-count">{nextMonthCount}</div>
</div>
