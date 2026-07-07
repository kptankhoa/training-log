# Calendar Month Scroll — Design

## Problem

`Calendar.svelte` already supports moving between months via the prev/next
buttons and a swipe gesture (`Calendar.svelte:83-94`), but the transition is
an instant snap — the grid's cells are simply replaced with the new month's
data with no visual motion. Additionally, there's no way to change months
with a mouse wheel / trackpad scroll, which is the natural desktop
equivalent of the mobile swipe gesture. This spec adds an animated
slide-transition between months, and a wheel/trackpad handler that drives
the same transition.

## Architecture

All of this lives inside `Calendar.svelte`. The component's public interface
is unchanged: it still receives `year`/`month`/`days`/`tags`/`splits` as
props and dispatches `selectDay` / `prevMonth` / `nextMonth` — the parent
(`calendar/+page.svelte`) needs no changes at all. Buttons, swipe, and wheel
all funnel through the same two dispatched events, and the slide animation
is driven purely by `year`/`month` prop changes — so the animation plays
identically no matter which of the three input sources triggered it.

## Animation Mechanics

Use Svelte's `{#key}` block + `transition:fly`, keyed on `` `${year}-${month}` ``:

```svelte
<div class="relative overflow-hidden">
  {#key `${year}-${month}`}
    <div
      class="grid grid-cols-7 gap-px ..."
      in:fly={{ x: `${direction * 100}%`, duration: mounted ? 250 : 0 }}
      out:fly={{ x: `${-direction * 100}%`, duration: mounted ? 250 : 0 }}
    >
      <!-- existing day cells -->
    </div>
  {/key}
</div>
```

When the key changes, Svelte runs the outgoing block's `out:fly` and the
new block's `in:fly` concurrently, both absolutely positioned via the
`relative overflow-hidden` wrapper so they visually cross over each other
(standard Svelte carousel/swap idiom — no manual `transform`/`rAF` code
needed).

**Suppressing the mount-time intro:** Svelte transitions play on initial
mount by default, so without a guard the grid would slide in from
off-screen every time the `/calendar` page first loads. `mounted` starts
`false` and flips to `true` in `onMount`, so both `fly` calls use
`duration: 0` (i.e. no visible motion) on first render, then real
250ms transitions from then on:

```ts
import { onMount } from 'svelte';

let mounted = false;
onMount(() => { mounted = true; });
```

**Direction:** a reactive value comparing the new `year*12 + month` ordinal
to the previously-displayed one:

```ts
let prevOrdinal = year * 12 + month;
let direction = 1; // 1 = forward (slide new in from the right), -1 = backward

$: {
  const ordinal = year * 12 + month;
  if (ordinal !== prevOrdinal) {
    direction = ordinal > prevOrdinal ? 1 : -1;
    prevOrdinal = ordinal;
  }
}
```

**Re-entry guard:** `isTransitioning` is set `true` when the key changes and
reset to `false` after 250ms (matching the animation duration) via
`setTimeout`. All three trigger paths (button `on:click`, swipe
`touchend`, wheel) check this flag before dispatching `prevMonth`/
`nextMonth`, and no-op if it's `true`. This is deliberately simple: extra
input during an in-flight transition is dropped rather than queued.

## Wheel Handling

The wheel listener attaches to the day-grid element only (not the header,
legend, or streak line below it) — scrolling anywhere else on the page
behaves exactly as it does today.

```ts
let wheelDelta = 0;
let wheelLocked = false;
const WHEEL_THRESHOLD = 50;
const WHEEL_COOLDOWN_MS = 500;

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

- `e.preventDefault()` fires on every wheel event received over the grid
  (whether or not it crosses the threshold this call), so the page itself
  never scrolls while the cursor is over the grid — the grid fully owns
  wheel input in that region. The listener must be registered
  non-passive (Svelte's `on:wheel` already allows `preventDefault`
  without extra modifiers).
- The threshold (~50) fires on the very first notch of a standard mouse
  wheel (typically `deltaY` ±100), so one notch = one month, matching a
  dropdown-style expectation.
- `wheelLocked` (500ms) exists because a slow trackpad swipe can keep
  emitting small `deltaY` events for longer than the 250ms animation —
  without this separate cooldown, the tail end of one physical gesture
  could sneak in a second month change once `isTransitioning` clears.
  `isTransitioning` and `wheelLocked` are independent flags checked
  together; `isTransitioning` alone still gates buttons and swipe.
- `wheelDelta` resets to 0 both on firing and is implicitly abandoned
  (never accumulates across gestures) since it's reset every time the
  threshold is crossed; a gesture that never crosses the threshold just
  fades out (no explicit idle-reset timer — YAGNI, since the next real
  gesture will accumulate from whatever small remainder is left, and that
  remainder is always well under the threshold).

## Swipe (existing code, unchanged behavior + new guard)

The existing `handleTouchStart`/`handleTouchEnd` logic
(`Calendar.svelte:83-94`) is unchanged except it now also checks
`isTransitioning` before dispatching, for consistency with the other two
input sources:

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

## Buttons (existing code, new guard)

```svelte
<button
  aria-label="Previous month"
  on:click={() => { if (!isTransitioning) dispatch('prevMonth'); }}
  ...
>‹</button>
```

(same pattern for the next-month button)

## Edge Cases

- **Year boundary** (December → January or vice versa): the ordinal
  comparison (`year * 12 + month`) handles this correctly with no special
  casing — `2026-12` → `2027-01` is ordinal 24324 → 24325, still `+1`.
- **Initial render:** `prevOrdinal` initializes from the first `year`/
  `month` props received, so `direction` is never miscomputed on mount
  (the reactive block only reassigns it when the ordinal actually
  changes). Separately, the `mounted` flag (see above) ensures no visible
  slide plays on the page's first paint regardless of `direction`'s
  initial value.
- **Rapid repeated input** (mashing the next button, or one long
  continuous wheel gesture): covered by `isTransitioning` +
  `wheelLocked` above — extra triggers are dropped, never queued.

## Testing

Extend `Calendar.test.ts`:
- Wheel event with `deltaY` past the threshold dispatches `nextMonth`;
  negative `deltaY` dispatches `prevMonth`.
- A wheel event with `deltaY` below the threshold dispatches nothing.
- Two wheel events fired back-to-back (both individually below threshold
  but summing past it) dispatch exactly once.
- A second wheel event fired immediately after one that just triggered a
  dispatch (simulating the cooldown window) does not dispatch again.
- A second button click fired immediately after the first (simulating
  mid-transition) does not dispatch a second time.
- (Existing swipe tests continue to pass unchanged; add one asserting a
  swipe during an active transition is ignored, mirroring the button
  case.)

No new test file — this all extends the existing `Calendar.test.ts`
alongside the current swipe/click/render tests.

## Out of Scope

- Live drag-following (the calendar tracking the finger/cursor position
  in real time during the gesture) — explicitly rejected in favor of the
  simpler threshold-then-snap-animate model, consistent with how swipe
  already works today.
- Horizontal/shift-wheel or any input source beyond buttons, swipe, and
  vertical wheel.
- Changes to `calendar/+page.svelte` or any other consumer — the prop/event
  interface of `Calendar.svelte` is unchanged.
- Any data-layer or Firestore change — this is a pure UI/interaction
  feature.
