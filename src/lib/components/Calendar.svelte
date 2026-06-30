<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { GRUVBOX_COLORS } from '$lib/gruvbox';
  import type { TrainingTag, DayEntry } from '$lib/types';

  export let year: number;
  export let month: number; // 1–12
  export let days: Record<string, DayEntry> = {};
  export let tags: TrainingTag[] = [];

  const dispatch = createEventDispatcher<{ selectDay: string; prevMonth: void; nextMonth: void }>();

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DAY_HEADERS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

  $: tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));

  $: gridCells = (() => {
    const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const leading = (firstDow + 6) % 7; // shift so Mon=0
    const count = new Date(year, month, 0).getDate();
    return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)] as (number | null)[];
  })();

  function key(d: number) {
    return `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  function tagColors(d: number): string[] {
    return (days[key(d)]?.tags ?? [])
      .map((id) => tagMap[id])
      .filter(Boolean)
      .map((t) => GRUVBOX_COLORS[t.color]);
  }

  function label(d: number) { return days[key(d)]?.label ?? ''; }
  function hasNote(d: number) { return !!(days[key(d)]?.note); }
</script>

<div class="select-none">
  <div class="flex items-center justify-between mb-3 px-1">
    <button aria-label="Previous month" on:click={() => dispatch('prevMonth')}
      class="text-gb-fg2 hover:text-gb-fg px-2 py-1 rounded hover:bg-gb-bg2 transition text-xl leading-none">‹</button>
    <h2 class="text-gb-green font-semibold text-lg">{MONTHS[month - 1]} {year}</h2>
    <button aria-label="Next month" on:click={() => dispatch('nextMonth')}
      class="text-gb-fg2 hover:text-gb-fg px-2 py-1 rounded hover:bg-gb-bg2 transition text-xl leading-none">›</button>
  </div>

  <div class="grid grid-cols-7 mb-1">
    {#each DAY_HEADERS as h}
      <div class="text-center text-xs text-gb-gray font-medium py-1">{h}</div>
    {/each}
  </div>

  <div class="grid grid-cols-7 gap-px bg-gb-bg2 border border-gb-bg2 rounded-lg overflow-hidden">
    {#each gridCells as cell}
      {#if cell === null}
        <div class="bg-gb-bg2 min-h-[4.5rem]"></div>
      {:else}
        <button
          type="button"
          on:click={() => dispatch('selectDay', key(cell))}
          data-has-note={hasNote(cell) ? '' : undefined}
          class="bg-gb-bg hover:bg-gb-bg1 transition min-h-[4.5rem] p-1.5
                 flex flex-col items-start gap-0.5 text-left"
        >
          <div class="flex items-center gap-1">
            <span class="text-xs text-gb-fg2 font-medium leading-none">{cell}</span>
            {#if hasNote(cell)}
              <span class="w-1.5 h-1.5 rounded-full bg-gb-gray shrink-0" title="Has note"></span>
            {/if}
          </div>

          {#if label(cell)}
            <span class="text-[10px] text-gb-fg3 leading-tight truncate w-full">{label(cell)}</span>
          {/if}

          <div class="flex flex-wrap gap-0.5 mt-auto">
            {#each tagColors(cell) as color}
              <span class="w-2 h-2 rounded-full shrink-0" style="background-color:{color}"></span>
            {/each}
          </div>
        </button>
      {/if}
    {/each}
  </div>
</div>
