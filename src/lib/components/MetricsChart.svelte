<script lang="ts">
  import { onMount } from 'svelte';
  import { measurements, measurementsLoading, initMeasurements, saveMeasurement, deleteMeasurement } from '$lib/stores/measurements';
  import LineChart from './LineChart.svelte';
  import Spinner from './Spinner.svelte';
  import type { BodyMeasurement } from '$lib/types';

  export let userId: string;

  onMount(() => {
    if (!userId) return;
    return initMeasurements(userId);
  });

  type MetricKey = 'weight' | 'muscleMass' | 'fatMass' | 'bfp' | 'score';
  const metrics: { key: MetricKey; label: string; unit: string; color: string }[] = [
    { key: 'weight',     label: 'Weight',      unit: ' kg', color: '#83a598' },
    { key: 'muscleMass', label: 'Muscle Mass', unit: ' kg', color: '#b8bb26' },
    { key: 'fatMass',    label: 'Fat Mass',    unit: ' kg', color: '#fe8019' },
    { key: 'bfp',        label: 'Body Fat %',  unit: '%',   color: '#fb4934' },
    { key: 'score',      label: 'Score',       unit: '',    color: '#d3869b' },
  ];

  type MetricTabKey = MetricKey | 'all';
  let activeMetric: MetricTabKey = 'all';
  $: activeMetricInfo = metrics.find((m) => m.key === activeMetric);

  function formatLabel(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  $: chartLabels = $measurements.map((e) => formatLabel(e.id));
  $: chartData = activeMetricInfo ? $measurements.map((e) => e[activeMetricInfo.key]) : [];
  $: chartSeries = activeMetric === 'all'
    ? metrics.map((m) => ({ label: m.label, data: $measurements.map((e) => e[m.key]), color: m.color, unit: m.unit }))
    : null;

  // Add entry form
  let showAddForm = false;
  let draftDate = new Date().toISOString().slice(0, 10);
  let draftWeight = '';
  let draftMuscleMass = '';
  let draftFatMass = '';
  let draftBfp = '';
  let draftScore = '';

  function resetDraft() {
    draftDate = new Date().toISOString().slice(0, 10);
    draftWeight = draftMuscleMass = draftFatMass = draftBfp = draftScore = '';
  }

  async function handleAddEntry() {
    if (!userId || !draftDate) return;
    const data: Omit<BodyMeasurement, 'id'> = {
      weight: Number(draftWeight) || 0,
      muscleMass: Number(draftMuscleMass) || 0,
      fatMass: Number(draftFatMass) || 0,
      bfp: Number(draftBfp) || 0,
      score: Number(draftScore) || 0,
    };
    await saveMeasurement(userId, draftDate, data);
    resetDraft();
    showAddForm = false;
  }

  async function handleDelete(id: string) {
    if (!userId) return;
    await deleteMeasurement(userId, id);
  }
</script>

<div class="flex flex-col gap-6">
  <!-- Metric tabs -->
  <div class="flex gap-2 overflow-x-auto pb-1">
    <button
      type="button"
      on:click={() => (activeMetric = 'all')}
      class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
             {activeMetric === 'all' ? 'border-gb-green text-gb-green bg-gb-bg1' : 'border-gb-bg3 text-gb-fg2 hover:bg-gb-bg1'}"
    >
      All
    </button>
    {#each metrics as m (m.key)}
      <button
        type="button"
        on:click={() => (activeMetric = m.key)}
        class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
               {activeMetric === m.key ? 'border-gb-green text-gb-green bg-gb-bg1' : 'border-gb-bg3 text-gb-fg2 hover:bg-gb-bg1'}"
      >
        {m.label}
      </button>
    {/each}
  </div>

  {#if $measurementsLoading}
    <Spinner />
  {:else if $measurements.length === 0}
    <div class="bg-gb-bg1 rounded-xl p-10 text-center flex flex-col gap-2">
      <p class="text-gb-fg3 text-lg">No measurements yet</p>
      <p class="text-gb-gray text-sm">Add an entry below to start tracking.</p>
    </div>
  {:else}
    <div class="bg-gb-bg1 rounded-xl p-4">
      {#if chartSeries}
        <LineChart labels={chartLabels} series={chartSeries} />
      {:else if activeMetricInfo}
        <LineChart labels={chartLabels} data={chartData} color={activeMetricInfo.color} unit={activeMetricInfo.unit} />
      {/if}
    </div>

    <!-- Entries list -->
    <section class="flex flex-col gap-2">
      <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2 text-sm uppercase tracking-wider">Entries</h2>
      <div class="flex flex-col gap-1">
        {#each [...$measurements].reverse() as entry (entry.id)}
          <div class="flex items-center gap-3 bg-gb-bg1 px-3 py-2 text-sm">
            <span class="text-gb-fg3 w-24 shrink-0">{formatLabel(entry.id)}</span>
            <span class="flex-1 text-gb-fg truncate">
              {entry.weight}kg · {entry.muscleMass}kg MM · {entry.fatMass}kg FM · {entry.bfp}% BF · {entry.score} score
            </span>
            <button
              type="button"
              on:click={() => handleDelete(entry.id)}
              aria-label="Delete entry for {entry.id}"
              class="text-gb-fg3 hover:text-gb-red transition-colors shrink-0"
            >✕</button>
          </div>
        {/each}
      </div>
    </section>
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
          <label for="m-date" class="text-xs text-gb-fg3 uppercase tracking-wider">Date</label>
          <input id="m-date" type="date" lang="en-GB" bind:value={draftDate}
            class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label for="m-weight" class="text-xs text-gb-fg3 uppercase tracking-wider">Weight (kg)</label>
            <input id="m-weight" type="number" step="0.1" bind:value={draftWeight}
              class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="m-muscle" class="text-xs text-gb-fg3 uppercase tracking-wider">Muscle Mass (kg)</label>
            <input id="m-muscle" type="number" step="0.1" bind:value={draftMuscleMass}
              class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="m-fat" class="text-xs text-gb-fg3 uppercase tracking-wider">Fat Mass (kg)</label>
            <input id="m-fat" type="number" step="0.1" bind:value={draftFatMass}
              class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="m-bfp" class="text-xs text-gb-fg3 uppercase tracking-wider">Body Fat %</label>
            <input id="m-bfp" type="number" step="0.1" bind:value={draftBfp}
              class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="m-score" class="text-xs text-gb-fg3 uppercase tracking-wider">Score</label>
            <input id="m-score" type="number" step="1" bind:value={draftScore}
              class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
          </div>
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
