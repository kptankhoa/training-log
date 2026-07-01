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
    Filler,
  } from 'chart.js';

  Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

  export let labels: string[] = [];
  export let data: number[] = [];
  export let color = '#b8bb26';
  export let unit = '';
  export let beginAtZero = false;

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function render() {
    if (!canvas) return;
    chart?.destroy();
    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data,
            borderColor: color,
            backgroundColor: `${color}33`,
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: color,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero, ticks: { color: '#a89984' }, grid: { color: '#3c3836' } },
          x: { ticks: { color: '#a89984' }, grid: { color: '#3c3836' } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y}${unit}`,
            },
          },
        },
      },
    });
  }

  onMount(render);
  $: if (canvas) { labels; data; color; beginAtZero; render(); }
  onDestroy(() => chart?.destroy());
</script>

<div class="relative h-56 w-full">
  <canvas bind:this={canvas}></canvas>
</div>
