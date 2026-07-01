<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import DayDetail from './DayDetail.svelte';
  import type { TrainingTag, DailyTask, Exercise, PlanNote, DayEntry } from '$lib/types';

  export let dateKey: string;      // YYYY-MM-DD
  export let entry: DayEntry;
  export let activeTags: TrainingTag[];
  export let activeTasks: DailyTask[] = [];
  export let exercises: Exercise[] = [];
  export let splits: PlanNote[] = [];
  export let allDays: Record<string, DayEntry> = {};
  export let userId: string;

  const dispatch = createEventDispatcher<{ close: void }>();

  // position: fixed sizes against the layout viewport, which doesn't shrink when
  // the mobile keyboard opens — track the visual viewport so the sheet resizes
  // to stay above the keyboard instead of being covered by it.
  let viewportHeight = '100dvh';

  function updateViewportHeight() {
    if (window.visualViewport) viewportHeight = `${window.visualViewport.height}px`;
  }

  onMount(() => {
    updateViewportHeight();
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    return () => window.visualViewport?.removeEventListener('resize', updateViewportHeight);
  });

  $: [yr, mo, dy] = dateKey.split('-').map(Number);
  $: heading = new Date(yr, mo - 1, dy).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') dispatch('close');
  }

  function handleSaved() {
    // let the "✓ Saved" state show for a beat before the sheet disappears
    setTimeout(() => dispatch('close'), 450);
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="fixed top-0 left-0 right-0 bg-black/60 z-60 flex items-end md:items-center justify-center"
  style="height: {viewportHeight};"
  on:click|self={() => dispatch('close')}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  tabindex="-1"
>
  <div class="bg-gb-bg1 w-full md:w-[520px] max-h-[85%] overflow-y-auto
              rounded-t-2xl md:rounded-xl shadow-2xl p-6 pb-24 md:pb-6 flex flex-col gap-5">

    <div class="flex items-start justify-between">
      <h2 id="modal-title" class="text-gb-green font-semibold text-lg leading-tight glow-green">{heading}</h2>
      <button
        type="button"
        on:click={() => dispatch('close')}
        aria-label="Close"
        class="text-gb-fg3 hover:text-gb-fg text-2xl leading-none ml-4 shrink-0"
      >×</button>
    </div>

    <DayDetail {dateKey} {entry} {activeTags} {activeTasks} {exercises} {splits} {allDays} {userId} on:saved={handleSaved} />
  </div>
</div>
