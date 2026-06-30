<script lang="ts">
  import '../app.css';
  import { user } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';

  onMount(() => {
    return user.subscribe((u) => {
      if (u === null && $page.url.pathname !== '/login') goto('/login');
    });
  });

  $: showShell = $page.url.pathname !== '/login';
</script>

{#if showShell}
  <div class="flex min-h-screen">
    <Sidebar />
    <main class="flex-1 overflow-y-auto pb-20 md:pb-0">
      <slot />
    </main>
  </div>
{:else}
  <slot />
{/if}
