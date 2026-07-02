<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { uploadPhoto, getPhotoUrl } from '$lib/stores/photos';

  export let photoPaths: string[] = [];
  export let readonly: boolean = false;
  export let dateKey: string = '';
  export let userId: string = '';
  export let noteEditing: boolean = false;

  let photoUrls: Record<string, string> = {};
  let uploadingPhoto = false;
  let photoError = false;
  let fileInput: HTMLInputElement;
  let lightboxUrl: string | null = null;

  onMount(() => {
    photoPaths.forEach((path) => {
      getPhotoUrl(path)
        .then((url) => { photoUrls[path] = url; photoUrls = photoUrls; })
        .catch((err) => console.error('[DayPhotos] failed to load photo:', err));
    });
  });

  function triggerPhotoPicker() {
    fileInput?.click();
  }

  async function handlePhotoSelect(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    uploadingPhoto = true;
    photoError = false;
    try {
      const path = await uploadPhoto(userId, dateKey, file);
      const url = await getPhotoUrl(path);
      photoUrls[path] = url;
      photoUrls = photoUrls;
      photoPaths = [...photoPaths, path];
    } catch (err) {
      photoError = true;
      console.error('[DayPhotos] photo upload failed:', err);
    } finally {
      uploadingPhoto = false;
    }
  }

  function removePhoto(path: string) {
    photoPaths = photoPaths.filter((p) => p !== path);
  }

  // "Click again to confirm" delete pattern — arms for 3s, then auto-reverts.
  let confirmingPhotoPath: string | null = null;
  let confirmPhotoTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleRemovePhotoClick(path: string) {
    if (confirmingPhotoPath === path) {
      if (confirmPhotoTimeout) clearTimeout(confirmPhotoTimeout);
      confirmingPhotoPath = null;
      removePhoto(path);
      return;
    }
    confirmingPhotoPath = path;
    if (confirmPhotoTimeout) clearTimeout(confirmPhotoTimeout);
    confirmPhotoTimeout = setTimeout(() => { confirmingPhotoPath = null; }, 3000);
  }

  onDestroy(() => {
    if (confirmPhotoTimeout) clearTimeout(confirmPhotoTimeout);
  });
</script>

{#if readonly}
  {#if photoPaths.length > 0}
    <div class="flex flex-col gap-1.5">
      <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Progress photos</span>
      <div class="flex flex-wrap gap-2">
        {#each photoPaths as path (path)}
          <button
            type="button"
            on:click={() => (lightboxUrl = photoUrls[path] ?? null)}
            disabled={!photoUrls[path]}
            class="w-20 h-20 shrink-0 bg-gb-light-bg2 dark:bg-gb-bg2 border border-gb-light-bg3 dark:border-gb-bg3 overflow-hidden flex items-center justify-center"
          >
            {#if photoUrls[path]}
              <img src={photoUrls[path]} alt="Training day snapshot" class="w-full h-full object-cover blur-md scale-110" />
            {:else}
              <span class="w-4 h-4 rounded-full border-2 border-gb-light-bg3 dark:border-gb-bg3 border-t-gb-light-green dark:border-t-gb-green animate-spin"></span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
{:else}
  <div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-2">
    <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Progress photos</span>
    <div class="flex flex-wrap gap-2">
      {#each photoPaths as path (path)}
        <div class="relative w-20 h-20 shrink-0 bg-gb-light-bg2 dark:bg-gb-bg2 border border-gb-light-bg3 dark:border-gb-bg3">
          <button
            type="button"
            on:click={() => (lightboxUrl = photoUrls[path] ?? null)}
            disabled={!photoUrls[path]}
            class="w-full h-full overflow-hidden flex items-center justify-center"
          >
            {#if photoUrls[path]}
              <img src={photoUrls[path]} alt="Training day snapshot" class="w-full h-full object-cover blur-md scale-110" />
            {:else}
              <span class="w-4 h-4 rounded-full border-2 border-gb-light-bg3 dark:border-gb-bg3 border-t-gb-light-green dark:border-t-gb-green animate-spin"></span>
            {/if}
          </button>
          <button
            type="button"
            on:click={() => handleRemovePhotoClick(path)}
            aria-label={confirmingPhotoPath === path ? 'Confirm remove photo' : 'Remove photo'}
            class="absolute -top-1.5 -right-1.5 flex items-center justify-center
                   bg-gb-light-red dark:bg-gb-red text-white leading-none transition-all
                   {confirmingPhotoPath === path ? 'px-1.5 h-5 text-[10px] font-semibold' : 'w-5 h-5 text-xs'}"
          >{confirmingPhotoPath === path ? 'Sure?' : '✕'}</button>
        </div>
      {/each}

      {#if uploadingPhoto}
        <div class="w-20 h-20 shrink-0 bg-gb-light-bg2 dark:bg-gb-bg2 border border-gb-light-bg3 dark:border-gb-bg3 flex items-center justify-center">
          <span class="w-4 h-4 rounded-full border-2 border-gb-light-bg3 dark:border-gb-bg3 border-t-gb-light-green dark:border-t-gb-green animate-spin"></span>
        </div>
      {/if}

      <button
        type="button"
        on:click={triggerPhotoPicker}
        disabled={uploadingPhoto}
        aria-label="Add photo"
        class="w-20 h-20 shrink-0 border border-dashed border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 text-2xl
               hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue transition disabled:opacity-40"
      >+</button>
    </div>
    {#if photoError}
      <span class="text-xs text-gb-light-red dark:text-gb-red">Upload failed — try again.</span>
    {/if}
    <input
      bind:this={fileInput}
      data-testid="photo-file-input"
      type="file"
      accept="image/*"
      capture="environment"
      on:change={handlePhotoSelect}
      class="hidden"
    />
  </div>
{/if}

{#if lightboxUrl}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4"
    on:click={() => (lightboxUrl = null)}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <img src={lightboxUrl} alt="Training day snapshot" class="max-w-full max-h-full object-contain" />
    <button
      type="button"
      on:click={() => (lightboxUrl = null)}
      aria-label="Close photo"
      class="absolute top-4 right-4 text-white text-3xl leading-none"
    >×</button>
  </div>
{/if}
