<script lang="ts">
  import { user } from '$lib/stores/auth';
  import { allDays } from '$lib/stores/days';
  import MetricsChart from '$lib/components/stats/MetricsChart.svelte';
  import MeasurementsTable from '$lib/components/stats/MeasurementsTable.svelte';
  import PhotoTimeline from '$lib/components/stats/PhotoTimeline.svelte';
  import { navColorClasses, navBorderClass, navTextClass } from '$lib/theme';

  $: userId = $user?.uid ?? '';

  type Section = 'metrics' | 'measurements' | 'photos';
  let activeSection: Section = 'metrics';
  let activeClass = `${navBorderClass('/stats')} ${navTextClass('/stats')} bg-gb-light-bg1 dark:bg-gb-bg1`;
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
  <h1 class="text-2xl font-bold {navColorClasses('/stats')}">Stats</h1>

  <!-- Section tabs -->
  <div class="flex gap-2">
    <button
      type="button"
      on:click={() => (activeSection = 'metrics')}
      class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
             {activeSection === 'metrics' ? activeClass : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg2 dark:text-gb-fg2 hover:bg-gb-light-bg1 dark:hover:bg-gb-bg1'}"
    >
      Metrics
    </button>
    <button
      type="button"
      on:click={() => (activeSection = 'measurements')}
      class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
             {activeSection === 'measurements' ? activeClass : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg2 dark:text-gb-fg2 hover:bg-gb-light-bg1 dark:hover:bg-gb-bg1'}"
    >
      Measurements
    </button>
    <button
      type="button"
      on:click={() => (activeSection = 'photos')}
      class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
             {activeSection === 'photos' ? activeClass : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg2 dark:text-gb-fg2 hover:bg-gb-light-bg1 dark:hover:bg-gb-bg1'}"
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
    <PhotoTimeline days={$allDays} {userId} />
  </div>
</div>
