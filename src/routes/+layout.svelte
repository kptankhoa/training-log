<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { user, authReady } from '$lib/stores/auth';
  import { initTags } from '$lib/stores/tags';
  import { initDays } from '$lib/stores/days';
  import { initTasks } from '$lib/stores/tasks';
  import { initExercises } from '$lib/stores/exercises';
  import { initSplits } from '$lib/stores/splits';
  import { initGeneralRules } from '$lib/stores/generalRules';
  import { theme, initTheme } from '$lib/stores/theme';
  import { restTimerSound, initRestTimerSound } from '$lib/stores/restTimerSound';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import Sidebar from '$lib/components/shell/Sidebar.svelte';

  $: if (browser && $authReady && $user === null && $page.url.pathname !== '/login') {
    goto('/login');
  }

  // Data shared across every page (calendar, home, settings, splits, train) —
  // subscribed once per login here instead of re-subscribing in each page's
  // onMount, which used to re-read these collections in full on every navigation.
  onMount(() => {
    const unsubs: (() => void)[] = [];
    const unsubUser = user.subscribe((u) => {
      unsubs.forEach((fn) => fn());
      unsubs.length = 0;
      if (!u) return;
      unsubs.push(initTags(u.uid));
      unsubs.push(initDays(u.uid));
      unsubs.push(initTasks(u.uid));
      unsubs.push(initExercises(u.uid));
      unsubs.push(initSplits(u.uid));
      unsubs.push(initGeneralRules(u.uid));
      unsubs.push(initTheme(u.uid));
      unsubs.push(initRestTimerSound(u.uid));
    });
    return () => {
      unsubUser();
      unsubs.forEach((fn) => fn());
    };
  });

  // Keep the live <html> class and the FOUC-avoidance localStorage cache
  // (read synchronously by the inline script in app.html) in sync with
  // whatever the theme store resolves to.
  $: if (browser) {
    document.documentElement.classList.toggle('dark', $theme === 'dark');
    localStorage.setItem('theme', $theme);
  }

  $: if (browser) {
    localStorage.setItem('restTimerSound', $restTimerSound);
  }

  $: showShell = $authReady && $user !== null && $page.url.pathname !== '/login';
  $: loading = !$authReady;
</script>

{#if loading}
  <div class="min-h-dvh flex items-center justify-center bg-gb-light-bg dark:bg-gb-bg">
    <div class="flex flex-col items-center gap-4">
      <div class="w-8 h-8 rounded-full border-2 border-gb-light-bg3 dark:border-gb-bg3 border-t-gb-light-green dark:border-t-gb-green animate-spin"></div>
      <span class="text-gb-light-fg3 dark:text-gb-fg3 text-sm tracking-widest uppercase">Loading</span>
    </div>
  </div>
{:else if showShell}
  <div class="flex min-h-dvh">
    <Sidebar />
    <main class="flex-1 h-dvh overflow-y-auto pb-20 md:pb-0 md:h-auto">
      <slot />
    </main>
  </div>
{:else}
  <slot />
{/if}
