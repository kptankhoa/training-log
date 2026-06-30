<script lang="ts">
  import { page } from '$app/stores';

  const nav = [
    { href: '/',         label: 'Calendar', icon: '📅' },
    { href: '/stats',    label: 'Stats',    icon: '📊' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  $: path = $page.url.pathname;
</script>

<!-- Desktop left rail -->
<nav class="hidden md:flex flex-col w-52 min-h-screen bg-gb-bg1 border-r border-gb-bg2 p-4 gap-1 shrink-0">
  <div class="text-gb-yellow font-bold text-lg mb-6 px-2">Fitness Tracker</div>
  {#each nav as item}
    <a
      href={item.href}
      class="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
             {path === item.href
               ? 'bg-gb-bg2 text-gb-yellow font-semibold'
               : 'text-gb-fg2 hover:text-gb-fg hover:bg-gb-bg2'}"
    >
      <span class="text-base">{item.icon}</span>
      {item.label}
    </a>
  {/each}
</nav>

<!-- Mobile bottom tab bar -->
<nav class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gb-bg1 border-t border-gb-bg2 flex">
  {#each nav as item}
    <a
      href={item.href}
      class="flex flex-1 flex-col items-center gap-0.5 py-3 text-xs transition-colors
             {path === item.href ? 'text-gb-yellow' : 'text-gb-fg3'}"
    >
      <span class="text-xl leading-none">{item.icon}</span>
      {item.label}
    </a>
  {/each}
</nav>
