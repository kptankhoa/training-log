<script lang="ts">
  import { signInWithGoogle, user } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    return user.subscribe((u) => { if (u) goto('/'); });
  });

  async function handleSignIn() {
    await signInWithGoogle();
    goto('/');
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gb-bg">
  <div class="bg-gb-bg1 rounded-lg p-10 flex flex-col items-center gap-6 shadow-xl">
    <h1 class="text-gb-yellow text-3xl font-bold tracking-wide">Fitness Tracker</h1>
    <p class="text-gb-fg3 text-sm">Track your training progress</p>
    <button
      on:click={handleSignIn}
      class="bg-gb-blue text-gb-bg font-semibold px-6 py-3 rounded-md hover:opacity-90 transition"
    >
      Sign in with Google
    </button>
  </div>
</div>
