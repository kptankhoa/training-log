<script lang="ts">
  import { page } from '$app/stores';
  import { signOut } from '$lib/stores/auth';
  import { icons } from '$lib/icons';

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
<nav class="hidden md:flex flex-col w-64 min-h-dvh bg-gb-bg0 border-r border-gb-bg2 p-4 gap-1 shrink-0">
  <div class="text-gb-green font-bold text-lg mb-6 px-2 glow-green flex items-center gap-2">
    {@html icons.dumbbell}
    Training Log
  </div>
  {#each nav as item}
    <a
      href={item.href}
      class="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
             {path === item.href
               ? 'bg-gb-bg2 text-gb-green font-semibold glow-green'
               : 'text-gb-fg2 hover:text-gb-fg hover:bg-gb-bg2'}"
    >
      <span class="shrink-0">{@html item.icon}</span>
      {item.label}
    </a>
  {/each}

  <div class="mt-auto pt-4 border-t border-gb-bg2">
    <button
      type="button"
      on:click={signOut}
      class="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-gb-fg3
             hover:text-gb-red hover:bg-gb-bg2 transition-colors"
    >
      {@html icons.signOut}
      Sign out
    </button>
  </div>
</nav>

<!-- Mobile bottom tab bar -->
<nav class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gb-bg0 border-t border-gb-bg2 flex">
  {#each nav as item}
    <a
      href={item.href}
      class="flex flex-1 flex-col items-center gap-0.5 py-3 text-xs transition-colors
             {path === item.href ? 'text-gb-green glow-green' : 'text-gb-fg3'}"
    >
      <span class="leading-none">{@html item.icon}</span>
      {item.label}
    </a>
  {/each}
</nav>
