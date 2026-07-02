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
          y: { beginAtZero, ticks: { color: '#a89984' }, grid: { color: '#3c3836' } },
          x: { ticks: { color: '#a89984' }, grid: { color: '#3c3836' } },
        },
        plugins: {
          legend: { display: showLegend, labels: { color: '#ebdbb2' } },
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
  $: if (canvas) { labels; lines; beginAtZero; render(); }
  onDestroy(() => chart?.destroy());
</script>

<div class="relative h-56 w-full">
  <canvas bind:this={canvas}></canvas>
</div>
