<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { marked } from 'marked';
  import { user } from '$lib/stores/auth';
  import { notes, initNotes } from '$lib/stores/notes';
  import { GRUVBOX_COLORS } from '$lib/gruvbox';
  import type { PlanNote } from '$lib/types';

  let selectedId: string | null = null;
  $: selectedSplit = $notes.find((n) => n.id === selectedId) ?? null;

  // Timer state
  let inputSeconds = 60;
  let remaining = 0;
  let running = false;
  let finished = false;
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

  function start() {
    running = true;
    interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        remaining = 0;
        running = false;
        finished = true;
        clearInterval(interval!);
        interval = null;
      }
    }, 1000);
  }

  function pause() {
    running = false;
    if (interval) { clearInterval(interval); interval = null; }
  }

  function reset() {
    pause();
    remaining = 0;
    finished = false;
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

  onMount(() => {
    const unsub = user.subscribe((u) => {
      if (u) initNotes(u.uid);
    });
    return unsub;
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
  <h1 class="text-gb-green text-2xl font-bold glow-green">Train</h1>

  <!-- Split picker -->
  <section class="flex flex-col gap-2">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2 text-sm uppercase tracking-wider">Select Split</h2>
    {#if $notes.length === 0}
      <p class="text-gb-fg3 text-sm">No splits yet — add one in <a href="/splits" class="text-gb-blue underline">Split Design</a>.</p>
    {:else}
      <div class="flex flex-wrap gap-2">
        {#each $notes as split (split.id)}
          <button
            type="button"
            on:click={() => selectedId = selectedId === split.id ? null : split.id}
            class="flex items-center gap-2 px-3 py-2 text-sm border transition
                   {selectedId === split.id
                     ? 'border-gb-green text-gb-green bg-gb-bg1'
                     : 'border-gb-bg3 text-gb-fg2 bg-gb-bg hover:bg-gb-bg1'}"
          >
            <span class="w-2.5 h-2.5 shrink-0 rounded-sm" style="background-color:{GRUVBOX_COLORS[split.color ?? 'blue']}"></span>
            {split.label || 'Untitled'}
          </button>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Split content -->
  {#if selectedSplit}
    <section class="flex flex-col gap-2">
      <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2 text-sm uppercase tracking-wider">{selectedSplit.label}</h2>
      {#if selectedSplit.content}
        <div class="prose prose-invert max-w-none text-sm text-gb-fg
                    [&_h1]:text-gb-green [&_h2]:text-gb-green [&_h3]:text-gb-green
                    [&_strong]:text-gb-orange [&_a]:text-gb-blue [&_li]:text-gb-fg">
          {@html marked(selectedSplit.content)}
        </div>
      {:else}
        <p class="text-gb-fg3 text-sm italic">No content for this split.</p>
      {/if}
    </section>
  {/if}

  <!-- Rest timer -->
  <section class="flex flex-col gap-4">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2 text-sm uppercase tracking-wider">Rest Timer</h2>

    <!-- Ring + time display -->
    <div class="flex flex-col items-center gap-4">
      <div class="relative w-36 h-36">
        <svg class="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" class="text-gb-bg2" stroke-width="8"/>
          <circle
            cx="60" cy="60" r={R} fill="none"
            stroke="currentColor"
            class="{finished ? 'text-gb-red' : 'text-gb-green'} transition-all duration-1000"
            stroke-width="8"
            stroke-linecap="round"
            stroke-dasharray={C}
            stroke-dashoffset={dashOffset}
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-2xl font-bold tabular-nums {finished ? 'text-gb-red' : running ? 'text-gb-green glow-green' : 'text-gb-fg'}">{displayTime}</span>
          {#if finished}
            <span class="text-xs text-gb-red uppercase tracking-widest mt-0.5">Go!</span>
          {:else if running}
            <span class="text-xs text-gb-fg3 uppercase tracking-widest mt-0.5">Rest</span>
          {/if}
        </div>
      </div>

      <!-- Duration input -->
      <div class="flex items-center gap-2 text-sm">
        <label class="text-gb-fg3">Rest:</label>
        <input
          type="number" min="1" max="3600"
          bind:value={inputSeconds}
          on:change={reset}
          disabled={running}
          class="w-16 text-center bg-gb-bg1 border border-gb-bg3 text-gb-fg px-2 py-1
                 focus:outline-none focus:border-gb-blue disabled:opacity-40"
        />
        <span class="text-gb-fg3">sec</span>
      </div>

      <!-- Controls -->
      <div class="flex gap-3">
        <button
          type="button"
          on:click={startStop}
          disabled={totalInput === 0}
          class="px-6 py-2 font-semibold text-sm transition
                 {running ? 'bg-gb-orange text-gb-bg' : 'bg-gb-green text-gb-bg'}
                 hover:opacity-90 disabled:opacity-40"
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
</div>
