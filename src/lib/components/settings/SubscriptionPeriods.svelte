<script lang="ts">
  import { updateTagSubscriptionPeriods } from '$lib/stores/tags';
  import { showError } from '$lib/stores/toast';
  import FormField from '$lib/components/shared/FormField.svelte';
  import type { TrainingTag, SubscriptionPeriod } from '$lib/types';

  export let tag: TrainingTag;
  export let userId: string;

  $: periods = tag.subscriptionPeriods ?? [];
  $: sortedIndices = periods
    .map((_, i) => i)
    .sort((a, b) => (periods[a].startDate > periods[b].startDate ? -1 : 1));

  let newStart = '';
  let newEnd = '';
  let newNote = '';

  let confirmingIndex: number | null = null;
  let confirmTimeout: ReturnType<typeof setTimeout> | null = null;

  function save(next: SubscriptionPeriod[]) {
    updateTagSubscriptionPeriods(userId, tag.id, next).catch(() => showError());
  }

  function addPeriod() {
    const startDate = newStart.trim();
    if (!startDate) return;
    const period: SubscriptionPeriod = { startDate };
    const endDate = newEnd.trim();
    const note = newNote.trim();
    if (endDate) period.endDate = endDate;
    if (note) period.note = note;
    save([...periods, period]);
    newStart = '';
    newEnd = '';
    newNote = '';
  }

  function updateField(index: number, field: 'startDate' | 'endDate' | 'note', value: string) {
    if (field === 'startDate' && !value.trim()) return;
    const next = periods.map((p, i) => {
      if (i !== index) return p;
      if (field === 'startDate') return { ...p, startDate: value };
      if (field === 'endDate') {
        const { endDate, ...rest } = p;
        return value ? { ...rest, endDate: value, dismissed: false } : { ...rest, dismissed: false };
      }
      const { note, ...rest } = p;
      return value ? { ...rest, note: value } : rest;
    });
    save(next);
  }

  function handleDeleteClick(index: number) {
    if (confirmingIndex === index) {
      if (confirmTimeout) clearTimeout(confirmTimeout);
      confirmingIndex = null;
      save(periods.filter((_, i) => i !== index));
      return;
    }
    confirmingIndex = index;
    if (confirmTimeout) clearTimeout(confirmTimeout);
    confirmTimeout = setTimeout(() => { confirmingIndex = null; }, 3000);
  }
</script>

<div class="flex flex-col gap-3 px-4 pb-3">
  {#if periods.length > 0}
    <ul class="flex flex-col gap-2">
      {#each sortedIndices as index (index)}
        <li class="flex flex-col gap-2 bg-gb-light-bg2 dark:bg-gb-bg2 p-3">
          <div class="flex items-center gap-2">
            <input
              type="date"
              aria-label="Start date"
              value={periods[index].startDate}
              on:change={(e) => updateField(index, 'startDate', e.currentTarget.value)}
              class="bg-gb-light-bg1 dark:bg-gb-bg1 text-gb-light-fg dark:text-gb-fg text-sm px-2 py-1 border border-gb-light-bg3 dark:border-gb-bg3 focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
            />
            <span class="text-gb-light-fg3 dark:text-gb-fg3 text-xs">&rarr;</span>
            <input
              type="date"
              aria-label="End date (blank = ongoing)"
              value={periods[index].endDate ?? ''}
              on:change={(e) => updateField(index, 'endDate', e.currentTarget.value)}
              class="bg-gb-light-bg1 dark:bg-gb-bg1 text-gb-light-fg dark:text-gb-fg text-sm px-2 py-1 border border-gb-light-bg3 dark:border-gb-bg3 focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
            />
            <button
              type="button"
              on:click={() => handleDeleteClick(index)}
              aria-label={confirmingIndex === index ? 'Confirm delete period' : 'Delete period'}
              class="text-xs font-medium px-2 py-1 transition-colors shrink-0
                     {confirmingIndex === index ? 'text-white bg-gb-light-red dark:bg-gb-red' : 'text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-red dark:hover:text-gb-red'}"
            >{confirmingIndex === index ? 'Confirm?' : '✕'}</button>
          </div>
          <input
            type="text"
            aria-label="Note"
            placeholder="Gym / location / price"
            value={periods[index].note ?? ''}
            on:change={(e) => updateField(index, 'note', e.currentTarget.value)}
            class="bg-gb-light-bg1 dark:bg-gb-bg1 text-gb-light-fg dark:text-gb-fg text-sm px-2 py-1 border border-gb-light-bg3 dark:border-gb-bg3 focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
          />
        </li>
      {/each}
    </ul>
  {/if}

  <div class="flex items-end gap-2">
    <FormField id="sub-new-start-{tag.id}" label="Start" type="date" bind:value={newStart} />
    <FormField id="sub-new-end-{tag.id}" label="End (optional)" type="date" bind:value={newEnd} />
  </div>
  <FormField id="sub-new-note-{tag.id}" label="Note (optional)" type="text" bind:value={newNote} />
  <button
    type="button"
    on:click={addPeriod}
    disabled={!newStart.trim()}
    class="bg-gb-light-blue dark:bg-gb-blue text-gb-light-bg dark:text-gb-bg font-semibold px-4 py-2 hover:opacity-90 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed self-start"
  >Add period</button>
</div>
