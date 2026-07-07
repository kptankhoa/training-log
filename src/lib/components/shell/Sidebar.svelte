<script lang="ts">
  import { page } from '$app/stores';
  import { signOut } from '$lib/stores/auth';
  import { icons, navColorClasses } from '$lib/theme';
  import { heading } from '$lib/decorators/heading';
  import { showError } from '$lib/stores/toast';

  function handleSignOut() {
    signOut().catch(() => showError('Failed to sign out — check your connection.'));
  }

  const nav = [
    { href: '/',         label: 'Today',    icon: icons.home     },
    { href: '/calendar', label: 'Calendar', icon: icons.calendar },
    { href: '/train',    label: 'Train',    icon: icons.clock    },
    { href: '/splits',   label: 'Splits',   icon: icons.document },
    { href: '/stats',    label: 'Stats',    icon: icons.barChart },
    { href: '/settings', label: 'Settings', icon: icons.settings },
  ];

  $: path = $page.url.pathname;
</script>

<!-- Desktop left rail -->
<nav class="hidden md:flex flex-col min-h-dvh bg-gb-light-bg0 dark:bg-gb-bg0 border-r border-gb-light-bg2 dark:border-gb-bg2 p-6 gap-1 shrink-0">
  <div class="mb-8 px-2 flex items-center gap-2">
    <span class="shrink-0 text-gb-light-green dark:text-gb-green dark:[filter:drop-shadow(0_0_6px_rgba(184,187,38,0.8))]">{@html icons.dumbbell}</span>
    <pre class="text-gb-light-green dark:text-gb-green glow-green font-mono text-[11px] leading-[1.15] whitespace-pre" aria-label="Training Log">{heading}</pre>
  </div>
  {#each nav as item}
    <a
      href={item.href}
      class="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
             {path === item.href
               ? `bg-gb-light-bg2 dark:bg-gb-bg2 font-semibold ${navColorClasses(item.href)}`
               : 'text-gb-light-fg2 dark:text-gb-fg2 hover:text-gb-light-fg dark:hover:text-gb-fg hover:bg-gb-light-bg2 dark:hover:bg-gb-bg2'}"
    >
      <span class="shrink-0">{@html item.icon}</span>
      {item.label}
    </a>
  {/each}

  <div class="mt-auto pt-4 border-t border-gb-light-bg2 dark:border-gb-bg2">
    <button
      type="button"
      on:click={handleSignOut}
      class="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-gb-light-fg3 dark:text-gb-fg3
             hover:text-gb-light-red dark:hover:text-gb-red hover:bg-gb-light-bg2 dark:hover:bg-gb-bg2 transition-colors"
    >
      {@html icons.signOut}
      Sign out
    </button>
  </div>
</nav>

<!-- Mobile bottom tab bar -->
<nav class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gb-light-bg0 dark:bg-gb-bg0 border-t border-gb-light-bg2 dark:border-gb-bg2 flex">
  {#each nav as item}
    <a
      href={item.href}
      class="flex flex-1 flex-col items-center gap-0.5 py-3 text-xs transition-colors
             {path === item.href ? navColorClasses(item.href) : 'text-gb-light-fg3 dark:text-gb-fg3'}"
    >
      <span class="leading-none">{@html item.icon}</span>
      {item.label}
    </a>
  {/each}
</nav>
