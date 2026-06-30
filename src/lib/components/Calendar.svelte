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

  type CellData = { null: true } | { num: number; colors: string[]; label: string; hasNote: boolean };

  $: cellData = gridCells.map((cell): CellData => {
    if (cell === null) return { null: true };
    const entry = days[key(cell)];
    return {
      num: cell,
      colors: (entry?.tags ?? []).map((id) => tagMap[id]).filter(Boolean).map((t) => GRUVBOX_COLORS[t.color]),
      label: entry?.label ?? '',
      hasNote: !!(entry?.note),
    };
  });

  $: trainedCount = cellData.filter((c) => !('null' in c) && (c as { colors: string[] }).colors.length > 0).length;
</script>

<div class="select-none">
  <div class="flex items-center justify-between mb-3 px-1">
    <button aria-label="Previous month" on:click={() => dispatch('prevMonth')}
      class="text-gb-fg2 hover:text-gb-fg px-2 py-1 rounded hover:bg-gb-bg2 transition text-xl leading-none">‹</button>
    <h2 class="text-gb-green font-semibold text-lg glow-green">{MONTHS[month - 1]} {year}</h2>
    <button aria-label="Next month" on:click={() => dispatch('nextMonth')}
      class="text-gb-fg2 hover:text-gb-fg px-2 py-1 rounded hover:bg-gb-bg2 transition text-xl leading-none">›</button>
  </div>

  <div class="grid grid-cols-7 mb-1">
    {#each DAY_HEADERS as h}
      <div class="text-center text-xs text-gb-gray font-medium py-1">{h}</div>
    {/each}
  </div>

  <div class="grid grid-cols-7 gap-px bg-gb-bg2 border border-gb-bg2 rounded-lg overflow-hidden">
    {#each cellData as cell}
      {#if 'null' in cell}
        <div class="bg-gb-bg2 min-h-[4.5rem]"></div>
      {:else}
        <button
          type="button"
          on:click={() => dispatch('selectDay', key(cell.num))}
          class="bg-gb-bg hover:bg-gb-bg1 transition min-h-[4.5rem] p-1.5
                 flex flex-col items-start gap-0.5 text-left"
        >
          <div class="flex items-center gap-1">
            <span class="text-xs text-gb-fg2 font-medium leading-none">{cell.num}</span>
            {#if cell.hasNote}
              <span class="w-1.5 h-1.5 rounded-full bg-gb-gray shrink-0" title="Has note"></span>
            {/if}
          </div>

          {#if cell.label}
            <span class="text-[10px] text-gb-fg3 leading-tight truncate w-full">{cell.label}</span>
          {/if}

          <div class="flex flex-wrap gap-0.5 mt-auto">
            {#each cell.colors as color}
              <span class="w-2 h-2 rounded-full shrink-0" style="background-color:{color}"></span>
            {/each}
          </div>
        </button>
      {/if}
    {/each}
  </div>

  <div class="mt-3 px-1 flex items-center gap-2 text-sm">
    <span class="text-gb-green font-semibold glow-green">{trainedCount}</span>
    <span class="text-gb-fg3">day{trainedCount !== 1 ? 's' : ''} trained this month</span>
  </div>
</div>
