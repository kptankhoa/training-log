<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toasts, dismissToast } from '$lib/stores/toast';
</script>

<div class="fixed bottom-20 md:bottom-6 inset-x-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-4">
  {#each $toasts as toast (toast.id)}
    <div
      role="alert"
      in:fly={{ y: 20, duration: 200 }}
      class="pointer-events-auto flex items-center gap-3 w-full max-w-sm bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-red dark:border-gb-red text-gb-light-fg dark:text-gb-fg text-sm px-4 py-3 shadow-lg"
    >
      <span class="flex-1">{toast.message}</span>
      <button
        type="button"
        on:click={() => dismissToast(toast.id)}
        aria-label="Dismiss"
        class="text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-fg dark:hover:text-gb-fg shrink-0"
      >✕</button>
    </div>
  {/each}
</div>
