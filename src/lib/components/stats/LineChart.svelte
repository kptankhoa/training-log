<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
    Filler,
  } from 'chart.js';
  import { theme } from '$lib/stores/theme';

  Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

  interface Series {
    label: string;
    data: number[];
    color: string;
    unit?: string;
  }

  export let labels: string[] = [];
  // Single-series shorthand props (used when `series` is not provided)
  export let data: number[] = [];
  export let color = '#b8bb26';
  export let unit = '';
  export let beginAtZero = false;
  export let series: Series[] | null = null;

  $: lines = series ?? [{ label: '', data, color, unit }];
  $: showLegend = lines.length > 1;

  $: tickColor = $theme === 'dark' ? '#a89984' : '#7c6f64';
  $: gridColor = $theme === 'dark' ? '#3c3836' : '#ebdbb2';
  $: legendColor = $theme === 'dark' ? '#ebdbb2' : '#3c3836';

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function render() {
    if (!canvas) return;
    chart?.destroy();
    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: lines.map((s) => ({
          label: s.label,
          data: s.data,
          borderColor: s.color,
          backgroundColor: `${s.color}33`,
          fill: !showLegend,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: s.color,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero, ticks: { color: tickColor }, grid: { color: gridColor } },
          x: { ticks: { color: tickColor }, grid: { color: gridColor } },
        },
        plugins: {
          legend: { display: showLegend, labels: { color: legendColor } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const s = lines[ctx.datasetIndex];
                return `${s.label ? s.label + ': ' : ''}${ctx.parsed.y}${s.unit ?? ''}`;
              },
            },
          },
        },
      },
    });
  }

  onMount(render);
  $: if (canvas) { labels; lines; beginAtZero; tickColor; gridColor; legendColor; render(); }
  onDestroy(() => chart?.destroy());
</script>

<div class="relative h-56 w-full">
  <canvas bind:this={canvas}></canvas>
</div>
