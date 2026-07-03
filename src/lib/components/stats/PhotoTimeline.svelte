<script lang="ts">
  import { onDestroy } from 'svelte';
  import { getPhotoUrl, getPhotoSize, deletePhoto } from '$lib/stores/photos';
  import { saveDay } from '$lib/stores/days';
  import type { DayEntry } from '$lib/types';

  export let days: Record<string, DayEntry> = {};
  export let userId: string = '';

  $: entries = Object.entries(days)
    .filter(([, e]) => (e.photos?.length ?? 0) > 0)
    .map(([dateKey, e]) => ({ dateKey, paths: e.photos! }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey)); // newest first

  let urls: Record<string, string> = {};
  let sizes: Record<string, number> = {};

  function loadMissingUrls(list: { dateKey: string; paths: string[] }[]) {
    list.forEach((entry) => {
      entry.paths.forEach((path) => {
        if (!urls[path]) {
          getPhotoUrl(path)
            .then((url) => { urls = { ...urls, [path]: url }; })
            .catch((err) => console.error('[PhotoTimeline] failed to load photo:', err));
        }
        if (sizes[path] === undefined) {
          getPhotoSize(path)
            .then((size) => { sizes = { ...sizes, [path]: size }; })
            .catch((err) => console.error('[PhotoTimeline] failed to load photo size:', err));
        }
      });
    });
  }

  $: loadMissingUrls(entries);

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    const rounded = Math.round(value * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}${units[unitIndex]}`;
  }

  function formatLabel(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  let lightboxUrl: string | null = null;

  async function removePhoto(dateKey: string, path: string) {
    const entry = days[dateKey];
    if (!entry) return;
    await saveDay(userId, dateKey, { ...entry, photos: (entry.photos ?? []).filter((p) => p !== path) });
    try {
      await deletePhoto(path);
    } catch (err) {
      // The Firestore reference is already gone, so the photo won't show up
      // again regardless — a failed blob delete just leaks storage, not UI state.
      console.error('[PhotoTimeline] failed to delete photo blob:', err);
    }
  }

  // "Click again to confirm" delete pattern — arms for 3s, then auto-reverts.
  let confirmingPhotoPath: string | null = null;
  let confirmPhotoTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleRemovePhotoClick(dateKey: string, path: string) {
    if (confirmingPhotoPath === path) {
      if (confirmPhotoTimeout) clearTimeout(confirmPhotoTimeout);
      confirmingPhotoPath = null;
      removePhoto(dateKey, path);
      return;
    }
    confirmingPhotoPath = path;
    if (confirmPhotoTimeout) clearTimeout(confirmPhotoTimeout);
    confirmPhotoTimeout = setTimeout(() => { confirmingPhotoPath = null; }, 3000);
  }

  onDestroy(() => {
    if (confirmPhotoTimeout) clearTimeout(confirmPhotoTimeout);
  });
</script>

{#if entries.length === 0}
  <p class="text-gb-light-fg3 dark:text-gb-fg3 text-sm">No progress photos yet — add some from a day's log.</p>
{:else}
  <div class="relative flex flex-col gap-6 pl-6 border-l-2 border-gb-light-bg3 dark:border-gb-bg3">
    {#each entries as entry (entry.dateKey)}
      <div class="relative">
        <span class="absolute -left-[1.6rem] top-1 w-3 h-3 rounded-full bg-gb-light-green dark:bg-gb-green"></span>
        <div class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider mb-2">{formatLabel(entry.dateKey)}</div>
        <div class="flex flex-wrap gap-2">
          {#each entry.paths as path (path)}
            <div class="flex flex-col items-center gap-1 w-20 shrink-0">
              <div class="relative w-20 h-20 shrink-0">
                <button
                  type="button"
                  on:click={() => (lightboxUrl = urls[path] ?? null)}
                  disabled={!urls[path]}
                  class="w-full h-full bg-gb-light-bg2 dark:bg-gb-bg2 border border-gb-light-bg3 dark:border-gb-bg3 overflow-hidden flex items-center justify-center"
                >
                  {#if urls[path]}
                    <img src={urls[path]} alt="Training day snapshot" class="w-full h-full object-cover" draggable="false" on:contextmenu|preventDefault />
                  {:else}
                    <span class="w-4 h-4 rounded-full border-2 border-gb-light-bg3 dark:border-gb-bg3 border-t-gb-light-green dark:border-t-gb-green animate-spin"></span>
                  {/if}
                </button>
                <button
                  type="button"
                  on:click={() => handleRemovePhotoClick(entry.dateKey, path)}
                  aria-label={confirmingPhotoPath === path ? 'Confirm remove photo' : 'Remove photo'}
                  class="absolute -top-1.5 -right-1.5 flex items-center justify-center
                         bg-gb-light-red dark:bg-gb-red text-white leading-none transition-all
                         {confirmingPhotoPath === path ? 'px-1.5 h-5 text-[10px] font-semibold' : 'w-5 h-5 text-xs'}"
                >{confirmingPhotoPath === path ? 'Sure?' : '✕'}</button>
              </div>
              {#if sizes[path] !== undefined}
                <span class="text-[10px] text-gb-light-fg3 dark:text-gb-fg3">{formatSize(sizes[path])}</span>
              {/if}
            </div>
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
    <img src={lightboxUrl} alt="Training day snapshot" class="max-w-full max-h-full object-contain" draggable="false" on:contextmenu|preventDefault />
    <button
      type="button"
      on:click={() => (lightboxUrl = null)}
      aria-label="Close"
      class="absolute top-4 right-4 text-white text-3xl leading-none"
    >×</button>
  </div>
{/if}
