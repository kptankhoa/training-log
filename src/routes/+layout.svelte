<script lang="ts">
  import '../app.css';
  import { user, authReady } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';

  onMount(() => {
    return user.subscribe((u) => {
      if (!$authReady) return;
      if (u === null && $page.url.pathname !== '/login') goto('/login');
    });
  });

  $: showShell = $authReady && $page.url.pathname !== '/login';
  $: loading = !$authReady;
</script>

{#if loading}
  <div class="min-h-screen flex items-center justify-center bg-gb-bg">
    <div class="flex flex-col items-center gap-4">
      <div class="w-8 h-8 rounded-full border-2 border-gb-bg3 border-t-gb-green animate-spin" />
      <span class="text-gb-fg3 text-sm tracking-widest uppercase">Loading</span>
    </div>
  </div>
{:else if showShell}
  <div class="flex min-h-screen">
    <Sidebar />
    <main class="flex-1 overflow-y-auto pb-20 md:pb-0">
      <slot />
    </main>
  </div>
{:else}
  <slot />
{/if}
