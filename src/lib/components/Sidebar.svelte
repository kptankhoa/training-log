<script lang="ts">
  import { page } from '$app/stores';

  const nav = [
    {
      href: '/',
      label: 'Calendar',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    },
    {
      href: '/notes',
      label: 'Notes',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    },
    {
      href: '/stats',
      label: 'Stats',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    },
  ];

  $: path = $page.url.pathname;
</script>

<!-- Desktop left rail -->
<nav class="hidden md:flex flex-col w-64 min-h-screen bg-gb-bg0 border-r border-gb-bg2 p-4 gap-1 shrink-0">
  <div class="text-gb-green font-bold text-lg mb-6 px-2 glow-green">Training Log</div>
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
