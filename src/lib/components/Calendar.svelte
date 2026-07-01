<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { GRUVBOX_COLORS } from '$lib/gruvbox';
  import { icons } from '$lib/icons';
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
    const tailing = (7 - (leading + count) % 7) % 7;
    return [
      ...Array(leading).fill(null),
      ...Array.from({ length: count }, (_, i) => i + 1),
      ...Array(tailing).fill(null)
    ] as (number | null)[];
  })();

  function key(d: number) {
    return `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  type CellData = { null: true } | { num: number; colors: string[]; label: string; hasNote: boolean; hasPhotos: boolean; isToday: boolean };

  $: cellData = gridCells.map((cell): CellData => {
    if (cell === null) return { null: true };
    const entry = days[key(cell)];
    return {
      num: cell,
      colors: (entry?.tags ?? []).map((id) => tagMap[id]).filter(Boolean).map((t) => GRUVBOX_COLORS[t.color]),
      label: entry?.label ?? '',
      hasNote: !!(entry?.note),
      hasPhotos: !!(entry?.photos?.length),
      isToday: key(cell) === todayKey,
    };
  });

  $: trainedCount = cellData.filter((c) => !('null' in c) && (c as { colors: string[] }).colors.length > 0).length;

  $: tagCounts = (() => {
    const counts: Record<string, number> = {};
    Object.values(days).forEach((entry) => {
      entry.tags.forEach((id) => { counts[id] = (counts[id] ?? 0) + 1; });
    });
    return counts;
  })();

  const SWIPE_THRESHOLD = 50;
  let touchStartX = 0;
  let touchStartY = 0;

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    dispatch(dx < 0 ? 'nextMonth' : 'prevMonth');
  }
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

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    data-testid="calendar-grid"
    class="grid grid-cols-7 gap-px bg-gb-bg2 border border-gb-bg2 rounded-lg overflow-hidden"
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
  >
    {#each cellData as cell}
      {#if 'null' in cell}
        <div class="bg-gb-bg3 min-h-[4.5rem]"></div>
      {:else}
        <button
          type="button"
          on:click={() => dispatch('selectDay', key(cell.num))}
          data-has-note={cell.hasNote ? '' : undefined}
          data-has-photos={cell.hasPhotos ? '' : undefined}
          data-today={cell.isToday ? '' : undefined}
          class="hover:bg-gb-bg1 transition min-h-[4.5rem] p-1.5
                 flex flex-col items-start gap-1 text-left
                 {cell.isToday ? 'bg-gb-bg1' : 'bg-gb-bg'}"
          style={cell.isToday ? 'box-shadow: inset 0 0 0 1px #b8bb26;' : ''}
        >
          <span class="text-xs font-medium leading-none {cell.isToday ? 'text-gb-green glow-green' : 'text-gb-fg2'}">{cell.num}</span>
          <div class="flex items-center gap-1.5">
            {#if cell.hasNote}
              <span class="text-gb-fg3 shrink-0" title="Has note">{@html icons.noteSm}</span>
            {/if}
            {#if cell.hasPhotos}
              <span class="text-gb-fg3 shrink-0" title="Has photos">{@html icons.cameraSm}</span>
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

  {#if tags.filter((t) => !t.deleted).length > 0}
    <div class="mt-4 px-1 flex flex-wrap gap-x-4 gap-y-1">
      {#each tags.filter((t) => !t.deleted) as tag (tag.id)}
        <span class="flex items-center gap-1.5 text-xs text-gb-fg3">
          <span class="w-2.5 h-2.5 shrink-0" style="background-color:{GRUVBOX_COLORS[tag.color]}"></span>
          {tag.name}
          <span class="text-gb-fg4 font-medium">{tagCounts[tag.id] ?? 0}x</span>
        </span>
      {/each}
    </div>
  {/if}

    <div class="mt-3 px-1 flex items-center gap-2 text-sm">
    <span class="text-gb-green font-semibold glow-green">{trainedCount}</span>
    <span class="text-gb-fg3">day{trainedCount !== 1 ? 's' : ''} trained this month</span>
  </div>
</div>
