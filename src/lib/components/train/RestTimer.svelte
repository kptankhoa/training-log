<script lang="ts">
  import { onDestroy } from 'svelte';

  const PRESETS = [30, 60, 75, 90, 120];

  // remaining is derived from a wall-clock deadline rather than decremented
  // per tick, because mobile browsers throttle timers in backgrounded/locked
  // tabs and a counter-based timer would silently run slow exactly when the
  // phone is set down to rest.
  let inputSeconds = 60;
  let remaining = 0;
  let running = false;
  let finished = false;
  let endAtMs = 0;
  let interval: ReturnType<typeof setInterval> | null = null;

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

  function tick() {
    remaining = Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000));
    if (remaining <= 0) {
      running = false;
      finished = true;
      if (interval) { clearInterval(interval); interval = null; }
    }
  }

  function start() {
    running = true;
    endAtMs = Date.now() + remaining * 1000;
    interval = setInterval(tick, 1000);
  }

  function pause() {
    if (running) tick(); // sync remaining with real elapsed time before stopping
    running = false;
    if (interval) { clearInterval(interval); interval = null; }
  }

  // Snap the display to real time the moment the tab wakes back up.
  function handleVisibilityChange() {
    if (running && document.visibilityState === 'visible') tick();
  }

  function reset() {
    pause();
    remaining = 0;
    finished = false;
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

  $: displayTime = remaining > 0 ? formatTime(remaining) : formatTime(totalInput);
  $: progress = remaining > 0 ? remaining / totalInput : (finished ? 0 : 1);

  // Circumference for the SVG ring
  const R = 54;
  const C = 2 * Math.PI * R;
  $: dashOffset = C * (1 - progress);

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });
</script>

<svelte:document on:visibilitychange={handleVisibilityChange} />

<section class="flex flex-col gap-4">
  <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2 text-sm uppercase tracking-wider">Rest Timer</h2>

  <!-- Ring + time display -->
  <div class="flex flex-col items-center gap-6">
    <div class="relative w-[10.5rem] h-[10.5rem]">
      <svg class="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" class="text-gb-bg2" stroke-width="8"/>
        <circle
          cx="60" cy="60" r={R} fill="none"
          stroke="currentColor"
          class="{finished ? 'text-gb-red' : 'text-gb-green'} transition-all duration-1000"
          stroke-width="8"
          stroke-linecap="round"
          stroke-dasharray={C}
          stroke-dashoffset={finished ? 0 : dashOffset}
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {#if finished}
          <span class="text-xs font-semibold uppercase tracking-widest" style="color:#fb4934">Go!</span>
        {:else if running}
          <span class="text-xs uppercase tracking-widest" style="color:#a89984">Rest</span>
        {:else}
          <span class="text-xs uppercase tracking-widest opacity-0">·</span>
        {/if}
        <span class="text-2xl font-bold tabular-nums" style="color:{finished ? '#fb4934' : running ? '#b8bb26' : '#ebdbb2'}">{displayTime}</span>
      </div>
    </div>

    <!-- Duration input -->
    <div class="flex items-center gap-2 text-sm">
      <label for="rest-seconds" class="text-gb-fg3">Rest:</label>
      <input
        id="rest-seconds"
        type="number" min="1" max="3600"
        bind:value={inputSeconds}
        on:change={reset}
        disabled={running || (remaining > 0 && !finished)}
        class="w-16 text-center bg-gb-bg1 border border-gb-bg3 text-gb-fg px-2 py-1
               focus:outline-none focus:border-gb-blue disabled:opacity-40"
      />
      <span class="text-gb-fg3">sec</span>
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
                   ? 'border-gb-green text-gb-green bg-gb-bg1'
                   : 'border-gb-bg3 text-gb-fg2 bg-gb-bg hover:bg-gb-bg1'}"
        >{secs}s</button>
      {/each}
    </div>

    <!-- Controls -->
    <div class="flex gap-3">
      <button
        type="button"
        on:click={startStop}
        disabled={totalInput === 0}
        class="px-6 py-2 font-semibold text-sm transition hover:opacity-90 disabled:opacity-40"
        style={running ? 'background:#fe8019;color:#fff' : 'background:#b8bb26;color:#1d2021'}
      >
        {running ? 'Pause' : remaining > 0 && !finished ? 'Resume' : 'Start'}
      </button>
      <button
        type="button"
        on:click={reset}
        class="px-4 py-2 text-sm text-gb-fg3 border border-gb-bg3 hover:bg-gb-bg1 transition"
      >
        Reset
      </button>
    </div>
  </div>
</section>
