<script lang="ts">
  import { getExpiringSoon } from '$lib/domain';
  import { updateTagSubscriptionPeriods } from '$lib/stores/tags';
  import { showError } from '$lib/stores/toast';
  import { gruvboxColors } from '$lib/theme';
  import type { TrainingTag, SubscriptionPeriod } from '$lib/types';

  export let tags: TrainingTag[] = [];
  export let userId: string;

  $: expiring = getExpiringSoon(tags);

  function message(daysRemaining: number, name: string): string {
    if (daysRemaining > 0) return `${name} ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
    if (daysRemaining === 0) return `${name} ends today`;
    const daysAgo = -daysRemaining;
    return `${name} ended ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
  }

  function dismiss(tag: TrainingTag, period: SubscriptionPeriod) {
    const periods = (tag.subscriptionPeriods ?? []).map((p) =>
      p === period ? { ...p, dismissed: true } : p
    );
    updateTagSubscriptionPeriods(userId, tag.id, periods).catch(() => showError());
  }
</script>

{#if expiring.length > 0}
  <div class="flex flex-col gap-2">
    {#each expiring as { tag, period, daysRemaining } (tag.id)}
      <div
        class="flex items-center gap-3 px-4 py-3 border-l-4 bg-gb-light-bg1 dark:bg-gb-bg1 text-sm"
        style="border-color: {$gruvboxColors[tag.color]}"
      >
        <span class="flex-1 text-gb-light-fg dark:text-gb-fg">
          {message(daysRemaining, tag.name)}
          {#if period.note}
            <span class="text-gb-light-fg3 dark:text-gb-fg3"> ({period.note})</span>
          {/if}
        </span>
        <button
          type="button"
          on:click={() => dismiss(tag, period)}
          aria-label="Dismiss {tag.name} reminder"
          class="text-xs font-medium text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-red dark:hover:text-gb-red transition-colors shrink-0"
        >Dismiss</button>
      </div>
    {/each}
  </div>
{/if}
