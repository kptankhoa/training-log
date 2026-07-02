<script lang="ts">
  import { user } from '$lib/stores/auth';
  import { allDays } from '$lib/stores/days';
  import MetricsChart from '$lib/components/MetricsChart.svelte';
  import MeasurementsTable from '$lib/components/MeasurementsTable.svelte';
  import PhotoTimeline from '$lib/components/PhotoTimeline.svelte';

  $: userId = $user?.uid ?? '';

  type Section = 'metrics' | 'measurements' | 'photos';
  let activeSection: Section = 'metrics';
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
  <h1 class="text-gb-green text-2xl font-bold glow-green">Stats</h1>

  <!-- Section tabs -->
  <div class="flex gap-2">
    <button
      type="button"
      on:click={() => (activeSection = 'metrics')}
      class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
             {activeSection === 'metrics' ? 'border-gb-green text-gb-green bg-gb-bg1' : 'border-gb-bg3 text-gb-fg2 hover:bg-gb-bg1'}"
    >
      Metrics
    </button>
    <button
      type="button"
      on:click={() => (activeSection = 'measurements')}
      class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
             {activeSection === 'measurements' ? 'border-gb-green text-gb-green bg-gb-bg1' : 'border-gb-bg3 text-gb-fg2 hover:bg-gb-bg1'}"
    >
      Measurements
    </button>
    <button
      type="button"
      on:click={() => (activeSection = 'photos')}
      class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
             {activeSection === 'photos' ? 'border-gb-green text-gb-green bg-gb-bg1' : 'border-gb-bg3 text-gb-fg2 hover:bg-gb-bg1'}"
    >
      Photos
    </button>
  </div>

  <div class:hidden={activeSection !== 'metrics'}>
    <MetricsChart {userId} />
  </div>
  <div class:hidden={activeSection !== 'measurements'}>
    <MeasurementsTable {userId} />
  </div>
  <div class:hidden={activeSection !== 'photos'}>
    <PhotoTimeline days={$allDays} />
  </div>
</div>
