<script lang="ts">
  import { onMount } from 'svelte';
  import {
    bodyMeasurements,
    bodyMeasurementsLoading,
    initBodyMeasurements,
    saveBodyMeasurement,
    deleteBodyMeasurement,
  } from '$lib/stores/bodyMeasurements';
  import Spinner from './Spinner.svelte';
  import type { BodyMeasurementEntry } from '$lib/types';

  export let userId: string;

  onMount(() => {
    if (!userId) return;
    return initBodyMeasurements(userId);
  });

  type FieldKey = Exclude<keyof BodyMeasurementEntry, 'id'>;
  const columns: { key: FieldKey; label: string; unit: string }[] = [
    { key: 'weight',    label: 'Weight',    unit: 'kg' },
    { key: 'chest',     label: 'Chest',     unit: 'cm' },
    { key: 'waist',     label: 'Waist',     unit: 'cm' },
    { key: 'handles',   label: 'Handles',   unit: 'cm' },
    { key: 'hip',       label: 'Hip',       unit: 'cm' },
    { key: 'armL',      label: 'Arm L',     unit: 'cm' },
    { key: 'forearmL',  label: 'Forearm L', unit: 'cm' },
    { key: 'armR',      label: 'Arm R',     unit: 'cm' },
    { key: 'forearmR',  label: 'Forearm R', unit: 'cm' },
    { key: 'thighL',    label: 'Thigh L',   unit: 'cm' },
    { key: 'thighR',    label: 'Thigh R',   unit: 'cm' },
    { key: 'calfL',     label: 'Calf L',    unit: 'cm' },
    { key: 'calfR',     label: 'Calf R',    unit: 'cm' },
  ];

  function formatLabel(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  function fmt(value: number | undefined): string {
    return value === undefined ? '—' : String(value);
  }

  async function handleDelete(id: string) {
    if (!userId) return;
    await deleteBodyMeasurement(userId, id);
  }

  // Add entry form
  let showAddForm = false;
  let draftDate = new Date().toISOString().slice(0, 10);
  let draftValues: Record<FieldKey, string> = {
    weight: '', chest: '', waist: '', handles: '', hip: '',
    armL: '', forearmL: '', armR: '', forearmR: '',
    thighL: '', thighR: '', calfL: '', calfR: '',
  };

  function resetDraft() {
    draftDate = new Date().toISOString().slice(0, 10);
    for (const key of Object.keys(draftValues) as FieldKey[]) draftValues[key] = '';
    draftValues = draftValues;
  }

  async function handleAddEntry() {
    if (!userId || !draftDate) return;
    const data: Partial<Omit<BodyMeasurementEntry, 'id'>> = {};
    for (const key of Object.keys(draftValues) as FieldKey[]) {
      const raw = String(draftValues[key]).trim();
      if (raw !== '') data[key] = Number(raw);
    }
    await saveBodyMeasurement(userId, draftDate, data);
    resetDraft();
    showAddForm = false;
  }
</script>

<div class="flex flex-col gap-6">
  {#if $bodyMeasurementsLoading}
    <Spinner />
  {:else if $bodyMeasurements.length === 0}
    <div class="bg-gb-bg1 rounded-xl p-10 text-center flex flex-col gap-2">
      <p class="text-gb-fg3 text-lg">No measurements yet</p>
      <p class="text-gb-gray text-sm">Add an entry below to start tracking.</p>
    </div>
  {:else}
    <div class="overflow-x-auto bg-gb-bg1 rounded-xl">
      <table class="text-sm border-collapse">
        <thead>
          <tr>
            <th class="sticky left-0 bg-gb-bg1 text-left px-3 py-2 text-gb-fg3 uppercase tracking-wider text-xs whitespace-nowrap">Date</th>
            {#each columns as col (col.key)}
              <th class="text-left px-3 py-2 text-gb-fg3 uppercase tracking-wider text-xs whitespace-nowrap">{col.label}</th>
            {/each}
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each [...$bodyMeasurements].reverse() as entry (entry.id)}
            <tr class="border-t border-gb-bg2">
              <td class="sticky left-0 bg-gb-bg1 px-3 py-2 text-gb-fg3 whitespace-nowrap">{formatLabel(entry.id)}</td>
              {#each columns as col (col.key)}
                <td class="px-3 py-2 text-gb-fg whitespace-nowrap">{fmt(entry[col.key])}</td>
              {/each}
              <td class="px-3 py-2">
                <button
                  type="button"
                  on:click={() => handleDelete(entry.id)}
                  aria-label="Delete entry for {entry.id}"
                  class="text-gb-fg3 hover:text-gb-red transition-colors"
                >✕</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Add entry -->
  <section class="flex flex-col gap-3">
    <button
      type="button"
      on:click={() => (showAddForm = !showAddForm)}
      class="text-sm text-gb-blue hover:text-gb-fg transition self-start"
    >
      {showAddForm ? '− Cancel' : '+ Add entry'}
    </button>

    {#if showAddForm}
      <div class="bg-gb-bg1 p-4 flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label for="bm-date" class="text-xs text-gb-fg3 uppercase tracking-wider">Date</label>
          <input id="bm-date" type="date" lang="en-GB" bind:value={draftDate}
            class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {#each columns as col (col.key)}
            <div class="flex flex-col gap-1">
              <label for="bm-{col.key}" class="text-xs text-gb-fg3 uppercase tracking-wider">{col.label} ({col.unit})</label>
              <input id="bm-{col.key}" type="number" step="0.1" bind:value={draftValues[col.key]}
                class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
            </div>
          {/each}
        </div>
        <button
          type="button"
          on:click={handleAddEntry}
          class="bg-gb-green text-gb-bg font-semibold px-4 py-2 text-sm hover:opacity-90 transition self-start"
        >Save entry</button>
      </div>
    {/if}
  </section>
</div>
