<script lang="ts">
  import { onDestroy } from 'svelte';
  import { restTimerSound, playRestTimerSound } from '$lib/stores/restTimerSound';

  const PRESETS = [30, 60, 75, 90, 120];

  // Circumference for the SVG ring
  const R = 54;
  const C = 2 * Math.PI * R;

  // remaining is derived from a wall-clock deadline rather than decremented
  // per tick, because mobile browsers throttle timers in backgrounded/locked
  // tabs and a counter-based timer would silently run slow exactly when the
  // phone is set down to rest.
  let inputSeconds = 60;
  let remaining = 0;
  let running = false;
  let finished = false;
  let endAtMs = 0;
  let tickTimeout: ReturnType<typeof setTimeout> | null = null;

  // The ring's own sweep — set imperatively by the two helpers below only,
  // never by the per-second tick. See the comment above syncRemaining().
  let ringOffset = 0;
  let circleEl: SVGCircleElement;
  let currentAnimation: Animation | null = null;

  function snapRingTo(offset: number) {
    currentAnimation?.cancel();
    currentAnimation = null;
    ringOffset = offset;
  }

  // Uses the Web Animations API instead of a CSS transition, on purpose:
  // CSS transitions only play when the browser diffs a genuine style change
  // against its previously *committed* value, which is inherently ambiguous
  // when triggered imperatively from JS — several attempts at forcing that
  // commit (a bare requestAnimationFrame, then Svelte's tick() plus an
  // explicit reflow) all worked in automated, isolated testing but still
  // proved intermittent in the app's real page, where other reactivity is
  // also changing things in the same moment. `element.animate()` has no such
  // ambiguity: calling it always plays the given keyframes immediately,
  // regardless of what else is happening in the DOM.
  function animateRingTo(offset: number, durationS: number) {
    const from = ringOffset;
    currentAnimation?.cancel();
    currentAnimation = circleEl?.animate(
      [{ strokeDashoffset: from }, { strokeDashoffset: offset }],
      { duration: Math.max(0, durationS * 1000), easing: 'linear', fill: 'forwards' }
    ) ?? null;
    ringOffset = offset; // keep the tracked value in sync with the animation's end state
  }

  $: totalInput = inputSeconds;

  function startStop() {
    if (running) {
      pause();
    } else {
      if (remaining === 0 || finished) {
        remaining = totalInput;
        finished = false;
      }
      start();
    }
  }

  // The once-a-second JS tick below only drives the digital readout and the
  // orange/red color threshold — it does NOT drive the ring's geometry (see
  // ringOffset/animateRingTo further up). Discrete per-second updates to a
  // *visual sweep* are fundamentally fragile: any main-thread jank (Chart.js
  // work, GC pause, a delayed setTimeout) that makes one tick late by more
  // than ~1s makes `remaining` drop by 2+ in a single step, and the ring
  // visibly jumps rather than reduces smoothly — a self-correcting scheduler
  // reduces how *often* this happens but can't eliminate it, since it can't
  // control how long the main thread is blocked. The ring is instead one
  // Web Animations API animation per run, handled entirely by the browser —
  // independent of JS timing once started, so main-thread jank can no longer
  // make it skip.
  //
  // syncRemaining() is side-effect-free on purpose (it never schedules
  // anything) so it's safe to call whenever the current wall-clock value is
  // needed (pausing, tab wake-up) without also kicking off a redundant,
  // orphaned tick alongside whatever's already scheduled.
  function syncRemaining() {
    remaining = Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000));
    if (remaining <= 0) {
      running = false;
      finished = true;
      animateRingTo(0, 0.5); // "time's up" flourish
      playRestTimerSound($restTimerSound);
    }
  }

  function scheduleNextTick() {
    const msIntoCurrentSecond = ((endAtMs - Date.now()) % 1000 + 1000) % 1000;
    tickTimeout = setTimeout(runScheduledTick, msIntoCurrentSecond || 1000);
  }

  function runScheduledTick() {
    syncRemaining();
    if (running) {
      scheduleNextTick();
    } else {
      tickTimeout = null;
    }
  }

  function start() {
    running = true;
    endAtMs = Date.now() + remaining * 1000;
    animateRingTo(C, remaining); // sweeps from wherever it currently is to "empty"
    scheduleNextTick();
  }

  function pause() {
    if (tickTimeout) { clearTimeout(tickTimeout); tickTimeout = null; }
    if (running) syncRemaining(); // sync remaining with real elapsed time before stopping
    running = false;
    // Freeze the ring at the position matching the just-synced `remaining`,
    // instantly, instead of leaving it mid-sweep toward the old target.
    snapRingTo(totalInput > 0 ? C * (1 - remaining / totalInput) : 0);
  }

  // Snap the display to real time the moment the tab wakes back up — also
  // clears any pending tick scheduled before backgrounding, since that delay
  // was computed against now-stale timing.
  function handleVisibilityChange() {
    if (running && document.visibilityState === 'visible') {
      if (tickTimeout) { clearTimeout(tickTimeout); tickTimeout = null; }
      syncRemaining();
      if (running) {
        animateRingTo(C, remaining); // resume the sweep from the corrected position
        scheduleNextTick();
      }
    }
  }

  function reset() {
    pause(); // freezes the ring instantly at the current position
    remaining = 0;
    finished = false;
    animateRingTo(0, 0.5); // animated refill back to full
  }

  function selectPreset(secs: number) {
    inputSeconds = secs;
    reset();
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  $: primaryActionLabel = running ? 'Pause' : remaining > 0 && !finished ? 'Resume' : 'Start';

  $: displayTime = remaining > 0 ? formatTime(remaining) : formatTime(totalInput);

  // Warn orange once past the halfway point, red once time's up.
  $: pastHalfway = remaining > 0 && remaining <= totalInput / 2;
  $: stateColorClass = finished
    ? 'text-gb-light-red dark:text-gb-red'
    : pastHalfway
      ? 'text-gb-light-orange dark:text-gb-orange'
      : 'text-gb-light-green dark:text-gb-green';

  onDestroy(() => {
    if (tickTimeout) clearTimeout(tickTimeout);
  });
</script>

<svelte:document on:visibilitychange={handleVisibilityChange} />

<section class="flex flex-col gap-4">
  <h2 class="text-gb-light-fg dark:text-gb-fg font-semibold border-b border-gb-light-bg2 dark:border-gb-bg2 pb-2 text-sm uppercase tracking-wider">Rest Timer</h2>

  <!-- Ring + time display -->
  <div class="flex flex-col items-center gap-6">
    <button
      type="button"
      on:click={startStop}
      disabled={totalInput === 0}
      aria-label="{primaryActionLabel} rest timer"
      class="relative w-[10.5rem] h-[10.5rem] mt-3 disabled:opacity-40"
    >
      <svg class="w-full h-full -rotate-90 overflow-visible" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" class="text-gb-light-bg2 dark:text-gb-bg2" stroke-width="8"/>
        <circle
          bind:this={circleEl}
          cx="60" cy="60" r={R} fill="none"
          stroke="currentColor"
          class="{stateColorClass} glow-ring"
          style="transition: color 1000ms ease;"
          stroke-width="8"
          stroke-linecap="round"
          stroke-dasharray={C}
          stroke-dashoffset={ringOffset}
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {#if finished}
          <span class="text-xs font-semibold uppercase tracking-widest text-gb-light-red dark:text-gb-red">Go!</span>
        {:else if running}
          <span class="text-xs uppercase tracking-widest text-gb-light-fg3 dark:text-gb-fg3">Rest</span>
        {:else}
          <span class="text-xs uppercase tracking-widest opacity-0">·</span>
        {/if}
        <span class="text-2xl font-bold tabular-nums transition-colors duration-1000 {remaining > 0 || finished ? stateColorClass : 'text-gb-light-fg dark:text-gb-fg'}">{displayTime}</span>
      </div>
    </button>

    <!-- Duration input -->
    <div class="flex items-center gap-2 text-sm">
      <label for="rest-seconds" class="text-gb-light-fg3 dark:text-gb-fg3">Rest:</label>
      <input
        id="rest-seconds"
        type="number" min="1" max="3600"
        bind:value={inputSeconds}
        on:change={reset}
        disabled={running || (remaining > 0 && !finished)}
        class="w-16 text-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg px-2 py-1
               focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue disabled:opacity-40"
      />
      <span class="text-gb-light-fg3 dark:text-gb-fg3">sec</span>
    </div>

    <!-- Presets -->
    <div class="flex gap-2 flex-wrap justify-center">
      {#each PRESETS as secs}
        <button
          type="button"
          on:click={() => selectPreset(secs)}
          disabled={running || (remaining > 0 && !finished)}
          class="px-3 py-1 text-sm border transition disabled:opacity-40
                 {inputSeconds === secs
                   ? 'border-gb-light-green dark:border-gb-green text-gb-light-green dark:text-gb-green bg-gb-light-bg1 dark:bg-gb-bg1'
                   : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg2 dark:text-gb-fg2 bg-gb-light-bg dark:bg-gb-bg hover:bg-gb-light-bg1 dark:hover:bg-gb-bg1'}"
        >{secs}s</button>
      {/each}
    </div>

    <!-- Controls -->
    <div class="flex gap-3">
      <button
        type="button"
        on:click={startStop}
        disabled={totalInput === 0}
        class="px-6 py-2 font-semibold text-sm transition hover:opacity-90 disabled:opacity-40
               {running ? 'bg-gb-light-orange dark:bg-gb-orange text-white' : 'bg-gb-light-green dark:bg-gb-green text-gb-light-bg dark:text-gb-bg'}"
      >
        {primaryActionLabel}
      </button>
      <button
        type="button"
        on:click={reset}
        class="px-4 py-2 text-sm text-gb-light-fg3 dark:text-gb-fg3 border border-gb-light-bg3 dark:border-gb-bg3 hover:bg-gb-light-bg1 dark:hover:bg-gb-bg1 transition"
      >
        Reset
      </button>
    </div>
  </div>
</section>
