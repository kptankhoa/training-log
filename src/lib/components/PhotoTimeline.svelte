<script lang="ts">
  import { getPhotoUrl } from '$lib/stores/photos';
  import type { DayEntry } from '$lib/types';

  export let days: Record<string, DayEntry> = {};

  $: entries = Object.entries(days)
    .filter(([, e]) => (e.photos?.length ?? 0) > 0)
    .map(([dateKey, e]) => ({ dateKey, paths: e.photos! }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey)); // newest first

  let urls: Record<string, string> = {};

  function loadMissingUrls(list: { dateKey: string; paths: string[] }[]) {
    list.forEach((entry) => {
      entry.paths.forEach((path) => {
        if (urls[path]) return;
        getPhotoUrl(path)
          .then((url) => { urls = { ...urls, [path]: url }; })
          .catch((err) => console.error('[PhotoTimeline] failed to load photo:', err));
      });
    });
  }

  $: loadMissingUrls(entries);

  function formatLabel(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  let lightboxUrl: string | null = null;
</script>

{#if entries.length === 0}
  <p class="text-gb-fg3 text-sm">No progress photos yet — add some from a day's log.</p>
{:else}
  <div class="relative flex flex-col gap-6 pl-6 border-l-2 border-gb-bg3">
    {#each entries as entry (entry.dateKey)}
      <div class="relative">
        <span class="absolute -left-[1.6rem] top-1 w-3 h-3 rounded-full bg-gb-green"></span>
        <div class="text-xs text-gb-fg3 uppercase tracking-wider mb-2">{formatLabel(entry.dateKey)}</div>
        <div class="flex flex-wrap gap-2">
          {#each entry.paths as path (path)}
            <button
              type="button"
              on:click={() => (lightboxUrl = urls[path] ?? null)}
              disabled={!urls[path]}
              class="w-20 h-20 shrink-0 bg-gb-bg2 border border-gb-bg3 overflow-hidden flex items-center justify-center"
            >
              {#if urls[path]}
                <img src={urls[path]} alt="Training day snapshot" class="w-full h-full object-cover" />
              {:else}
                <span class="w-4 h-4 rounded-full border-2 border-gb-bg3 border-t-gb-green animate-spin"></span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}

{#if lightboxUrl}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4"
    on:click={() => (lightboxUrl = null)}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <img src={lightboxUrl} alt="Training day snapshot" class="max-w-full max-h-full object-contain" />
    <button
      type="button"
      on:click={() => (lightboxUrl = null)}
      aria-label="Close"
      class="absolute top-4 right-4 text-white text-3xl leading-none"
    >×</button>
  </div>
{/if}
