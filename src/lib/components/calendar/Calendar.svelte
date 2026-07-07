<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { gruvboxColors } from '$lib/gruvbox';
  import { theme } from '$lib/stores/theme';
  import { icons } from '$lib/icons';
  import { navColorClasses } from '$lib/navColors';
  import type { TrainingTag, Split, DayEntry } from '$lib/types';

  export let year: number;
  export let month: number; // 1–12
  export let days: Record<string, DayEntry> = {};
  export let tags: TrainingTag[] = [];
  export let splits: Split[] = [];

  const dispatch = createEventDispatcher<{ selectDay: string; prevMonth: void; nextMonth: void }>();

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DAY_HEADERS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

  $: tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));
  $: splitMap = Object.fromEntries(splits.map((s) => [s.id, s]));

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

  $: rows = gridCells.length / 7;

  let mounted = false;
  onMount(() => { mounted = true; });

  let prevOrdinal = year * 12 + month;
  let direction = 1; // 1 = forward (new month enters from the right), -1 = backward

  let isTransitioning = false;
  // Starts at 0, not `rows` — `rows` is itself a `$:` value and isn't
  // computed yet at this point in component initialization; the reactive
  // block below sets the real value on its first run instead.
  let displayRows = 0;

  $: {
    const ordinal = year * 12 + month;
    if (ordinal !== prevOrdinal) {
      direction = ordinal > prevOrdinal ? 1 : -1;
      prevOrdinal = ordinal;
      isTransitioning = true;
      // Hold the larger of the outgoing/incoming row counts for the
      // transition's duration so a 6-week month sliding out isn't clipped
      // by a 5-week month's shorter wrapper height.
      displayRows = Math.max(displayRows, rows);
      setTimeout(() => { isTransitioning = false; }, 250);
    } else if (!isTransitioning) {
      displayRows = rows;
    }
  }

  function key(d: number) {
    return `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  type CellData = { null: true } | {
    num: number; colors: string[]; splitColors: string[]; tagIds: string[]; label: string;
    hasNote: boolean; hasPhotos: boolean; isToday: boolean;
  };

  $: cellData = gridCells.map((cell): CellData => {
    if (cell === null) return { null: true };
    const entry = days[key(cell)];
    return {
      num: cell,
      colors: (entry?.tags ?? []).map((id) => tagMap[id]).filter(Boolean).map((t) => $gruvboxColors[t.color]),
      splitColors: (entry?.splitIds ?? []).map((id) => splitMap[id]).filter(Boolean).map((s) => $gruvboxColors[s.color ?? 'blue']),
      tagIds: [...(entry?.tags ?? []), ...(entry?.splitIds ?? [])],
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

  let selectedTagId: string | null = null;

  function toggleTagFilter(tagId: string) {
    selectedTagId = selectedTagId === tagId ? null : tagId;
  }

  const SWIPE_THRESHOLD = 50;
  let touchStartX = 0;
  let touchStartY = 0;

  const WHEEL_THRESHOLD = 50;
  const WHEEL_COOLDOWN_MS = 500;
  let wheelDelta = 0;
  let wheelLocked = false;

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (isTransitioning || wheelLocked) return;

    wheelDelta += e.deltaY;
    if (Math.abs(wheelDelta) < WHEEL_THRESHOLD) return;

    dispatch(wheelDelta > 0 ? 'nextMonth' : 'prevMonth');
    wheelDelta = 0;
    wheelLocked = true;
    setTimeout(() => { wheelLocked = false; }, WHEEL_COOLDOWN_MS);
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchEnd(e: TouchEvent) {
    if (isTransitioning) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    dispatch(dx < 0 ? 'nextMonth' : 'prevMonth');
  }

  function getSelectedIdColor() {
    if (!selectedTagId) return null;
    const el = tagMap[selectedTagId] ?? splitMap[selectedTagId];
    return el ? $gruvboxColors[el.color] : null;
  }
</script>

<div class="select-none">
  <div class="flex items-center justify-between mb-3 px-1">
    <button aria-label="Previous month" on:click={() => { if (!isTransitioning) dispatch('prevMonth'); }}
      class="text-gb-light-fg2 dark:text-gb-fg2 hover:text-gb-light-fg dark:hover:text-gb-fg px-2 py-1 rounded hover:bg-gb-light-bg2 dark:hover:bg-gb-bg2 transition text-xl leading-none">‹</button>
    <h2 class="font-semibold text-lg {navColorClasses('/calendar')}">{MONTHS[month - 1]} {year}</h2>
    <button aria-label="Next month" on:click={() => { if (!isTransitioning) dispatch('nextMonth'); }}
      class="text-gb-light-fg2 dark:text-gb-fg2 hover:text-gb-light-fg dark:hover:text-gb-fg px-2 py-1 rounded hover:bg-gb-light-bg2 dark:hover:bg-gb-bg2 transition text-xl leading-none">›</button>
  </div>

  <div class="grid grid-cols-7 mb-1">
    {#each DAY_HEADERS as h}
      <div class="text-center text-xs text-gb-light-gray dark:text-gb-gray font-medium py-1">{h}</div>
    {/each}
  </div>

  <div class="relative overflow-hidden" style="height: {displayRows * 4.5}rem">
    {#key `${year}-${month}`}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        data-testid="calendar-grid"
        class="absolute inset-0 grid grid-cols-7 gap-px bg-gb-light-bg2 dark:bg-gb-bg2 border border-gb-light-bg2 dark:border-gb-bg2 rounded-lg overflow-hidden"
        on:touchstart={handleTouchStart}
        on:touchend={handleTouchEnd}
        on:wheel={handleWheel}
        in:fly={{ x: `${direction * 100}%`, duration: mounted ? 250 : 0 }}
        out:fly={{ x: `${-direction * 100}%`, duration: mounted ? 250 : 0 }}
      >
        {#each cellData as cell}
          {#if 'null' in cell}
            <div class="bg-gb-light-bg3 dark:bg-gb-bg3 min-h-[4.5rem]"></div>
          {:else}
            <button
              type="button"
              on:click={() => dispatch('selectDay', key(cell.num))}
              data-has-note={cell.hasNote ? '' : undefined}
              data-has-photos={cell.hasPhotos ? '' : undefined}
              data-today={cell.isToday ? '' : undefined}
              data-tag-match={selectedTagId && cell.tagIds.includes(selectedTagId) ? '' : undefined}
              class="hover:bg-gb-light-bg1 dark:hover:bg-gb-bg1 transition min-h-[4.5rem] p-1.5
                     flex flex-col items-start gap-1 text-left
                     {cell.isToday ? 'bg-gb-light-bg1 dark:bg-gb-bg1' : 'bg-gb-light-bg dark:bg-gb-bg'}
                     {selectedTagId && !cell.tagIds.includes(selectedTagId) ? 'opacity-30' : ''}"
              style={selectedTagId && cell.tagIds.includes(selectedTagId)
                ? `box-shadow: inset 0 0 0 2px ${getSelectedIdColor() ?? ($theme === 'dark' ? '#ebdbb2' : '#3c3836')};`
                : cell.isToday ? `box-shadow: inset 0 0 0 1px ${$theme === 'dark' ? '#83a598' : '#076678'};` : ''}
            >
              <span class="text-xs font-medium leading-none {cell.isToday ? navColorClasses('/calendar') : 'text-gb-light-fg2 dark:text-gb-fg2'}">{cell.num}</span>
              <div class="flex items-center gap-1.5">
                {#if cell.hasNote}
                  <span class="text-gb-light-fg3 dark:text-gb-fg3 shrink-0" title="Has note">{@html icons.noteSm}</span>
                {/if}
                {#if cell.hasPhotos}
                  <span class="text-gb-light-fg3 dark:text-gb-fg3 shrink-0" title="Has photos">{@html icons.cameraSm}</span>
                {/if}
              </div>

              {#if cell.label}
                <span class="text-[10px] text-gb-light-fg3 dark:text-gb-fg3 leading-tight truncate w-full">{cell.label}</span>
              {/if}

              <div class="flex items-center justify-between w-full mt-auto">
                <div class="flex flex-wrap gap-0.5">
                  {#each cell.colors as color}
                    <span class="w-2 h-2 rounded-full shrink-0" style="background-color:{color}"></span>
                  {/each}
                </div>
                <div class="flex flex-wrap gap-0.5">
                  {#each cell.splitColors as color}
                    <span class="w-2 h-2 rounded-full shrink-0" style="background-color:{color}"></span>
                  {/each}
                </div>
              </div>
            </button>
          {/if}
        {/each}
      </div>
    {/key}
  </div>

  {#if tags.filter((t) => !t.deleted).length > 0}
    <div class="mt-4 px-1 flex flex-wrap gap-x-4 gap-y-1">
    <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 font-semibold uppercase tracking-wider">
      Tags:
    </span>
      {#each tags.filter((t) => !t.deleted) as tag (tag.id)}
        <button
          type="button"
          on:click={() => toggleTagFilter(tag.id)}
          aria-pressed={selectedTagId === tag.id}
          class="flex items-center gap-1.5 text-xs transition
                 {selectedTagId === tag.id ? 'text-gb-light-fg dark:text-gb-fg font-semibold' : 'text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-fg dark:hover:text-gb-fg'}"
        >
          <span class="w-2.5 h-2.5 shrink-0" style="background-color:{$gruvboxColors[tag.color]}"></span>
          {tag.name}
          <span class="text-gb-light-fg4 dark:text-gb-fg4 font-medium">{tagCounts[tag.id] ?? 0}x</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if splits.length > 0}
    <div class="mt-2 px-1 flex flex-wrap gap-x-4 gap-y-1">
    <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 font-semibold uppercase tracking-wider">
      Splits:
    </span>
      {#each splits as split (split.id)}
        <button
          type="button"
          on:click={() => toggleTagFilter(split.id)}
          aria-pressed={selectedTagId === split.id}
          class="flex items-center gap-1.5 text-xs transition
                 {selectedTagId === split.id ? 'text-gb-light-fg dark:text-gb-fg font-semibold' : 'text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-fg dark:hover:text-gb-fg'}"
        >
          <span class="w-2.5 h-2.5 shrink-0" style="background-color:{$gruvboxColors[split.color]}"></span>
          {split.label}
        </button>
      {/each}
    </div>
  {/if}

    <div class="mt-3 px-1 flex items-center gap-2 text-sm">
    <span class="text-gb-light-green dark:text-gb-green font-semibold glow-green">{trainedCount}</span>
    <span class="text-gb-light-fg3 dark:text-gb-fg3">day{trainedCount !== 1 ? 's' : ''} trained this month</span>
  </div>
</div>
