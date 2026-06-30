<script lang="ts">
  import { onDestroy } from 'svelte';
  import { user } from '$lib/stores/auth';
  import { tags, activeTags, initTags } from '$lib/stores/tags';
  import { days, initDays } from '$lib/stores/days';
  import { globalNote, initNote, saveNote } from '$lib/stores/note';
  import Calendar from '$lib/components/Calendar.svelte';
  import DayModal from '$lib/components/DayModal.svelte';
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';

  let selectedDate: string | null = null;
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth() + 1;

  let unsubTags: (() => void) | null = null;
  let unsubDays: (() => void) | null = null;
  let unsubNote: (() => void) | null = null;

  $: userId = $user?.uid ?? '';

  $: if (userId) {
    unsubTags?.(); unsubTags = initTags(userId);
    unsubNote?.(); unsubNote = initNote(userId);
  }

  $: if (userId && (viewYear || viewMonth)) {
    unsubDays?.();
    unsubDays = initDays(userId, viewYear, viewMonth);
  }

  onDestroy(() => { unsubTags?.(); unsubDays?.(); unsubNote?.(); });

  function prevMonth() {
    if (viewMonth === 1) { viewMonth = 12; viewYear -= 1; }
    else viewMonth -= 1;
  }

  function nextMonth() {
    if (viewMonth === 12) { viewMonth = 1; viewYear += 1; }
    else viewMonth += 1;
  }

  $: selectedEntry = selectedDate
    ? ($days[selectedDate] ?? { tags: [], label: '', note: '' })
    : null;

  let noteSaveTimer: ReturnType<typeof setTimeout>;
  function scheduleNoteSave() {
    clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(() => { if (userId) saveNote(userId, $globalNote); }, 800);
  }
</script>

<div class="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-8">
  <Calendar
    year={viewYear}
    month={viewMonth}
    days={$days}
    tags={$tags}
    on:selectDay={(e) => (selectedDate = e.detail)}
    on:prevMonth={prevMonth}
    on:nextMonth={nextMonth}
  />

  <div class="flex flex-col gap-2" on:focusout={scheduleNoteSave}>
    <MarkdownEditor
      bind:value={$globalNote}
      placeholder="Training schedule, weekly goals, quotes…"
      initialMode="preview"
      label="Notepad"
    />
  </div>
</div>

{#if selectedDate && selectedEntry && userId}
  <DayModal
    dateKey={selectedDate}
    entry={selectedEntry}
    activeTags={$activeTags}
    {userId}
    on:close={() => (selectedDate = null)}
  />
{/if}
