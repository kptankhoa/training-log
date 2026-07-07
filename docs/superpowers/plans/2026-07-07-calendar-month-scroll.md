# Calendar Month Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated slide transition between calendar months (driven by the existing prev/next buttons and swipe gesture), plus mouse-wheel/trackpad support for changing months.

**Architecture:** Everything lives inside `src/lib/components/calendar/Calendar.svelte`. The component's public prop/event interface is unchanged — buttons, swipe, and a new wheel handler all dispatch the existing `prevMonth`/`nextMonth` events, and the slide animation is driven purely by `year`/`month` prop changes (via a Svelte `{#key}` block + `transition:fly`), so it plays identically regardless of which input triggered it. `calendar/+page.svelte` needs no changes.

**Tech Stack:** SvelteKit 2, Svelte 5 legacy syntax, `svelte/transition` (`fly`), Vitest + @testing-library/svelte.

## Global Constraints

- Slide animation duration: 250ms.
- Wheel deltaY accumulates until it crosses a threshold of 50, then fires once and resets to 0.
- After a wheel-triggered dispatch, further wheel input is ignored for 500ms (independent of the 250ms animation guard) — a slow trackpad gesture can outlast the animation and would otherwise sneak in a second month change.
- `isTransitioning` (true for 250ms after any month change starts) gates all three input sources — buttons, swipe, and wheel. Extra input during an active transition is dropped, never queued.
- The wheel listener attaches to the day-grid element only (not the header, legend, or streak line below it) — scrolling anywhere else on the page behaves exactly as it does today.
- `e.preventDefault()` fires on every wheel event received over the grid, whether or not it crosses the threshold, so the page itself never scrolls while the cursor is over the grid.
- No visible slide plays on the very first paint of the `/calendar` page (Svelte transitions play on initial mount by default; this is suppressed via a `mounted` flag that zeroes the `duration` until after `onMount`).
- Direction: compare `year*12 + month` (new) to the previously-displayed value. Forward (new > old) → `direction = 1` (new month enters from the right, old exits left). Backward → `direction = -1` (mirrored). This handles the December→January year boundary with no special-casing.
- No changes to `calendar/+page.svelte` or `Calendar.svelte`'s public props/events (`year`, `month`, `days`, `tags`, `splits`, `selectDay`, `prevMonth`, `nextMonth`).

---

### Task 1: Animated month transition (buttons + swipe)

**Files:**
- Modify: `src/lib/components/calendar/Calendar.svelte`
- Modify: `src/lib/components/calendar/CalendarTest.svelte`
- Test: `src/lib/components/calendar/Calendar.test.ts`

**Interfaces:**
- Consumes: existing `createEventDispatcher<{ selectDay: string; prevMonth: void; nextMonth: void }>()` (`Calendar.svelte:2,15`), existing `gridCells`/`cellData` reactive values, existing `handleTouchStart`/`handleTouchEnd`, existing prev/next `<button>` elements.
- Produces (for Task 2 to consume): a reactive boolean `isTransitioning` — `true` for 250ms after `year`/`month` props change, `false` otherwise. Task 2's wheel handler must check this before dispatching.

- [ ] **Step 1: Update the test helper, then write the failing tests**

`CalendarTest.svelte` currently only *counts* `prevMonth`/`nextMonth` events — it never feeds a new `year`/`month` back into `Calendar`, so `Calendar` never actually sees a month change when a test clicks the button. The new guard tests need that real round-trip (mirroring what `calendar/+page.svelte` already does), so update the wrapper first:

Replace the full contents of `src/lib/components/calendar/CalendarTest.svelte`:

```svelte
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
```

This is a pure behavior addition (the wrapper now actually navigates), so every existing test that uses `CalendarTest` keeps passing unchanged.

Now add these tests to the end of the `describe('Calendar', ...)` block in `src/lib/components/calendar/Calendar.test.ts`, right after the existing `'does not switch months on a mostly-vertical swipe'` test (before the closing `});` of the describe block):

```ts
  describe('month transition guard', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('ignores a second next-month click fired immediately after the first (mid-transition)', async () => {
      const { getByLabelText, getByTestId } = render(CalendarTest, {
        props: { year: 2026, month: 6, days: {}, tags: [] }
      });
      const nextBtn = getByLabelText('Next month');
      await fireEvent.click(nextBtn);
      await fireEvent.click(nextBtn);
      expect(getByTestId('next-month-count').textContent).toBe('1');
    });

    it('accepts a next-month click again once the transition settles (250ms)', async () => {
      const { getByLabelText, getByTestId } = render(CalendarTest, {
        props: { year: 2026, month: 6, days: {}, tags: [] }
      });
      const nextBtn = getByLabelText('Next month');
      await fireEvent.click(nextBtn);
      await vi.advanceTimersByTimeAsync(250);
      await fireEvent.click(nextBtn);
      expect(getByTestId('next-month-count').textContent).toBe('2');
    });

    it('ignores a swipe fired during an active transition triggered by a button click', async () => {
      const { getByLabelText, getAllByTestId, getByTestId } = render(CalendarTest, {
        props: { year: 2026, month: 6, days: {}, tags: [] }
      });
      await fireEvent.click(getByLabelText('Next month'));

      // Mid-transition, both the outgoing (June) and incoming (July) grid
      // elements exist in the DOM at once (Svelte keeps an out:transitioning
      // element mounted until its animation finishes) — target the newest one.
      const grids = getAllByTestId('calendar-grid');
      const grid = grids[grids.length - 1];
      await fireEvent.touchStart(grid, { touches: [{ clientX: 200, clientY: 100 }] });
      await fireEvent.touchEnd(grid, { changedTouches: [{ clientX: 100, clientY: 100 }] });

      expect(getByTestId('next-month-count').textContent).toBe('1');
    });
  });
```

- [ ] **Step 2: Run tests to verify the expected ones fail**

Run: `npx vitest run src/lib/components/calendar/Calendar.test.ts`

Expected:
- `ignores a second next-month click fired immediately after the first (mid-transition)` FAILS — count is `'2'`, no guard exists yet.
- `accepts a next-month click again once the transition settles (250ms)` — this one will already pass (nothing currently blocks repeated clicks). That's expected and fine; it becomes a real regression check once Step 3 adds a *time-limited* guard.
- `ignores a swipe fired during an active transition triggered by a button click` FAILS — count is `'2'`, the swipe dispatches unconditionally.
- All pre-existing tests still PASS (the `CalendarTest.svelte` change is additive).

- [ ] **Step 3: Implement the guard + slide transition**

In `src/lib/components/calendar/Calendar.svelte`, update the imports:

```svelte
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { gruvboxColors } from '$lib/gruvbox';
  import { theme } from '$lib/stores/theme';
  import { icons } from '$lib/icons';
  import { navColorClasses } from '$lib/navColors';
  import type { TrainingTag, Split, DayEntry } from '$lib/types';
```

Right after the existing `gridCells` reactive block (ends with `})();` — the block that computes `leading`/`count`/`tailing`) and before `function key(d: number) {`, add:

```ts
  $: rows = gridCells.length / 7;

  let mounted = false;
  onMount(() => { mounted = true; });

  let prevOrdinal = year * 12 + month;
  let direction = 1; // 1 = forward (new month enters from the right), -1 = backward

  let isTransitioning = false;

  $: {
    const ordinal = year * 12 + month;
    if (ordinal !== prevOrdinal) {
      direction = ordinal > prevOrdinal ? 1 : -1;
      prevOrdinal = ordinal;
      isTransitioning = true;
      setTimeout(() => { isTransitioning = false; }, 250);
    }
  }
```

Update `handleTouchEnd` to check the guard:

```ts
  function handleTouchEnd(e: TouchEvent) {
    if (isTransitioning) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    dispatch(dx < 0 ? 'nextMonth' : 'prevMonth');
  }
```

Update the prev/next buttons in the template to check the guard:

```svelte
    <button aria-label="Previous month" on:click={() => { if (!isTransitioning) dispatch('prevMonth'); }}
      class="text-gb-light-fg2 dark:text-gb-fg2 hover:text-gb-light-fg dark:hover:text-gb-fg px-2 py-1 rounded hover:bg-gb-light-bg2 dark:hover:bg-gb-bg2 transition text-xl leading-none">‹</button>
    <h2 class="font-semibold text-lg {navColorClasses('/calendar')}">{MONTHS[month - 1]} {year}</h2>
    <button aria-label="Next month" on:click={() => { if (!isTransitioning) dispatch('nextMonth'); }}
      class="text-gb-light-fg2 dark:text-gb-fg2 hover:text-gb-light-fg dark:hover:text-gb-fg px-2 py-1 rounded hover:bg-gb-light-bg2 dark:hover:bg-gb-bg2 transition text-xl leading-none">›</button>
```

Replace the day-grid block (the `<!-- svelte-ignore a11y_no_static_element_interactions -->` div and its contents) with a keyed, animated version. The wrapper needs an explicit height because the grid inside it becomes `position: absolute` (so the outgoing and incoming months overlay each other instead of stacking vertically during the crossfade) — absolutely positioned children don't otherwise contribute to their parent's height:

```svelte
  <div class="relative overflow-hidden" style="height: {rows * 4.5}rem">
    {#key `${year}-${month}`}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        data-testid="calendar-grid"
        class="absolute inset-0 grid grid-cols-7 gap-px bg-gb-light-bg2 dark:bg-gb-bg2 border border-gb-light-bg2 dark:border-gb-bg2 rounded-lg overflow-hidden"
        on:touchstart={handleTouchStart}
        on:touchend={handleTouchEnd}
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
```

- [ ] **Step 4: Run tests to verify they pass, then run the full suite and type-check**

Run: `npx vitest run src/lib/components/calendar/Calendar.test.ts`
Expected: all tests PASS, including the three new ones.

Run: `npx vitest run`
Expected: full suite still passes (no regressions in other components).

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/calendar/Calendar.svelte src/lib/components/calendar/CalendarTest.svelte src/lib/components/calendar/Calendar.test.ts
git commit -m "feat: animate calendar month transitions on button/swipe navigation"
```

---

### Task 2: Mouse wheel / trackpad month switching

**Files:**
- Modify: `src/lib/components/calendar/Calendar.svelte`
- Test: `src/lib/components/calendar/Calendar.test.ts`

**Interfaces:**
- Consumes: `isTransitioning` (reactive boolean, produced by Task 1 — `true` for 250ms after a month change starts), existing `dispatch` function, the day-grid `<div data-testid="calendar-grid">` element created in Task 1 (this task only adds one more `on:wheel` attribute to it).
- Produces: `handleWheel(e: WheelEvent): void`, wired via `on:wheel={handleWheel}` on the day-grid element. No other component consumes this — it's wired directly into the template.

- [ ] **Step 1: Write the failing tests**

Add these tests to `src/lib/components/calendar/Calendar.test.ts`, in a new `describe` block after the `month transition guard` block added in Task 1:

```ts
  describe('wheel scroll', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('a downward wheel scroll past the threshold dispatches nextMonth', async () => {
      const { getByTestId } = render(CalendarTest, { props: { year: 2026, month: 6, days: {}, tags: [] } });
      const grid = getByTestId('calendar-grid');
      await fireEvent.wheel(grid, { deltaY: 60 });
      expect(getByTestId('next-month-count').textContent).toBe('1');
    });

    it('an upward wheel scroll past the threshold dispatches prevMonth', async () => {
      const { getByTestId } = render(CalendarTest, { props: { year: 2026, month: 6, days: {}, tags: [] } });
      const grid = getByTestId('calendar-grid');
      await fireEvent.wheel(grid, { deltaY: -60 });
      expect(getByTestId('prev-month-count').textContent).toBe('1');
    });

    it('a wheel event below the threshold does not switch months', async () => {
      const { getByTestId } = render(CalendarTest, { props: { year: 2026, month: 6, days: {}, tags: [] } });
      const grid = getByTestId('calendar-grid');
      await fireEvent.wheel(grid, { deltaY: 20 });
      expect(getByTestId('next-month-count').textContent).toBe('0');
      expect(getByTestId('prev-month-count').textContent).toBe('0');
    });

    it('accumulates deltaY across multiple wheel events until crossing the threshold', async () => {
      const { getByTestId } = render(CalendarTest, { props: { year: 2026, month: 6, days: {}, tags: [] } });
      const grid = getByTestId('calendar-grid');
      await fireEvent.wheel(grid, { deltaY: 30 });
      expect(getByTestId('next-month-count').textContent).toBe('0');
      await fireEvent.wheel(grid, { deltaY: 30 });
      expect(getByTestId('next-month-count').textContent).toBe('1');
    });

    it('ignores further wheel input during the post-dispatch cooldown', async () => {
      const { getByTestId } = render(CalendarTest, { props: { year: 2026, month: 6, days: {}, tags: [] } });
      const grid = getByTestId('calendar-grid');
      await fireEvent.wheel(grid, { deltaY: 60 });
      expect(getByTestId('next-month-count').textContent).toBe('1');
      await fireEvent.wheel(grid, { deltaY: 60 });
      expect(getByTestId('next-month-count').textContent).toBe('1');
    });

    it('accepts wheel input again once the cooldown expires (500ms)', async () => {
      const { getByTestId } = render(CalendarTest, { props: { year: 2026, month: 6, days: {}, tags: [] } });
      const grid = getByTestId('calendar-grid');
      await fireEvent.wheel(grid, { deltaY: 60 });
      expect(getByTestId('next-month-count').textContent).toBe('1');
      await vi.advanceTimersByTimeAsync(500);
      await fireEvent.wheel(grid, { deltaY: 60 });
      expect(getByTestId('next-month-count').textContent).toBe('2');
    });

    it('calls preventDefault on every wheel event over the grid so the page itself never scrolls', async () => {
      const { getByTestId } = render(CalendarTest, { props: { year: 2026, month: 6, days: {}, tags: [] } });
      const grid = getByTestId('calendar-grid');
      const event = new WheelEvent('wheel', { deltaY: 10, cancelable: true, bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      await fireEvent(grid, event);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/components/calendar/Calendar.test.ts`
Expected: all 7 new tests in the `wheel scroll` block FAIL — there's no `on:wheel` handler yet, so no dispatch ever fires and `preventDefault` is never called.

- [ ] **Step 3: Implement wheel handling**

In `src/lib/components/calendar/Calendar.svelte`, find the existing swipe-related declarations:

```ts
  const SWIPE_THRESHOLD = 50;
  let touchStartX = 0;
  let touchStartY = 0;
```

Add the wheel state and handler directly after them (before `function handleTouchStart`):

```ts
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
```

Add `on:wheel={handleWheel}` to the day-grid element (the one Task 1 created inside the `{#key}` block), alongside the existing `on:touchstart`/`on:touchend`:

```svelte
      <div
        data-testid="calendar-grid"
        class="absolute inset-0 grid grid-cols-7 gap-px bg-gb-light-bg2 dark:bg-gb-bg2 border border-gb-light-bg2 dark:border-gb-bg2 rounded-lg overflow-hidden"
        on:touchstart={handleTouchStart}
        on:touchend={handleTouchEnd}
        on:wheel={handleWheel}
        in:fly={{ x: `${direction * 100}%`, duration: mounted ? 250 : 0 }}
        out:fly={{ x: `${-direction * 100}%`, duration: mounted ? 250 : 0 }}
      >
```

- [ ] **Step 4: Run tests to verify they pass, then run the full suite and type-check**

Run: `npx vitest run src/lib/components/calendar/Calendar.test.ts`
Expected: all tests PASS, including the 7 new wheel tests.

Run: `npx vitest run`
Expected: full suite still passes.

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/calendar/Calendar.svelte src/lib/components/calendar/Calendar.test.ts
git commit -m "feat: switch calendar months with mouse wheel / trackpad scroll"
```
