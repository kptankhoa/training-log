# DayDetail Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 528-line `DayDetail.svelte` into five focused components (`DayPhotos`, `DayTagsField`, `DaySplitsExercises`, `DayDetailView`, `DayDetailEditForm`) plus a small orchestrator, with zero change to `DayDetail`'s external prop/event interface or any observable behavior.

**Architecture:** Each extracted field-component (`DayPhotos`, `DayTagsField`, `DaySplitsExercises`) owns both its read-only and edit-mode rendering internally, switched by a `readonly` prop, plus any state that's purely about *how that field is displayed/edited* (accordion expand state, lightbox, upload progress, confirm-to-delete timers). `DayDetailView` and `DayDetailEditForm` compose those field-components for the two modes. `DayDetail.svelte` keeps only the *draft state that must survive a save or a cancel* (the actual field values) and the save/cancel/mode orchestration, rendering `DayDetailView` or `DayDetailEditForm` based on `mode`.

**Tech Stack:** SvelteKit (Svelte 5 legacy component syntax — `export let`, `on:click`, `$:`, `bind:`), Vitest + @testing-library/svelte.

## Global Constraints

- Zero behavior change: every interaction (tag toggle/add, split/exercise logging, photo upload/remove/lightbox, save/cancel, view/edit switching, the "hide other sections while editing the note" behavior) must work identically to today.
- `DayDetail.svelte`'s external prop list (`dateKey`, `entry`, `activeTags`, `activeTasks`, `exercises`, `splits`, `allDays`, `userId`, `hideOtherSectionsWhileEditingNote`) and its `saved` event stay exactly as they are — `DayModal.svelte`, `src/routes/+page.svelte`, and `src/routes/calendar/+page.svelte` need zero changes.
- Each extracted component takes a `readonly: boolean = false` prop switching between read-only and edit rendering, and (when it has edit-mode content that should hide on mobile while the note is being edited) a `noteEditing: boolean = false` prop applied to its own edit-mode wrapper exactly as `DayDetail` does today (`class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-N"`).
- Component props that are only meaningful in edit mode (`dateKey`, `userId` for `DayPhotos`/`DaySplitsExercises`; `userId` for `DayTagsField`) get a `= ''` default so read-only usages don't need to pass them.
- Follow the existing test-wrapper pattern (`DayModalTest.svelte`, `TagChipTest.svelte`) for any component whose test needs to observe a dispatched event or a two-way `bind:` prop — do not rely on `component.$on(...)` directly.
- Run `npx vitest run` and `npm run check` after every task; both must be clean before moving on.

---

### Task 1: `DayPhotos.svelte`

**Files:**
- Create: `src/lib/components/DayPhotos.svelte`
- Create: `src/lib/components/DayPhotos.test.ts`

**Interfaces:**
- Consumes: `uploadPhoto`, `getPhotoUrl` from `$lib/stores/photos` (pre-existing, unchanged). Does **not** import `deletePhoto` — that stays a `DayDetail`-only concern (Storage deletion only happens after a successful save).
- Produces: `DayPhotos.svelte` with props `photoPaths: string[]` (bindable), `readonly: boolean = false`, `dateKey: string = ''`, `userId: string = ''`, `noteEditing: boolean = false`. No events.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/DayPhotos.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DayPhotos from './DayPhotos.svelte';

vi.mock('$lib/stores/photos', () => ({
  uploadPhoto: vi.fn().mockResolvedValue('users/user1/days/2026-06-10/photo.jpg'),
  getPhotoUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
}));

describe('DayPhotos — readonly mode', () => {
  it('shows nothing when there are no photos', () => {
    const { queryByText } = render(DayPhotos, { props: { photoPaths: [], readonly: true } });
    expect(queryByText('Progress photos')).not.toBeInTheDocument();
  });

  it('shows existing photos as thumbnails', async () => {
    const { findByAltText } = render(DayPhotos, {
      props: { photoPaths: ['users/user1/days/2026-06-10/existing.jpg'], readonly: true }
    });
    expect(await findByAltText('Training day snapshot')).toBeInTheDocument();
  });

  it('opens and closes a lightbox on thumbnail click', async () => {
    const { findByAltText, getByRole, getByLabelText, queryByLabelText } = render(DayPhotos, {
      props: { photoPaths: ['users/user1/days/2026-06-10/existing.jpg'], readonly: true }
    });
    const thumbnail = await findByAltText('Training day snapshot');
    await fireEvent.click(thumbnail.closest('button')!);
    expect(getByRole('dialog')).toBeInTheDocument();

    await fireEvent.click(getByLabelText('Close photo'));
    expect(queryByLabelText('Close photo')).not.toBeInTheDocument();
  });

  it('does not show the upload tile', () => {
    const { queryByLabelText } = render(DayPhotos, { props: { photoPaths: [], readonly: true } });
    expect(queryByLabelText('Add photo')).not.toBeInTheDocument();
  });
});

describe('DayPhotos — edit mode', () => {
  it('always shows the section, even with no photos yet', () => {
    const { getByText, getByLabelText } = render(DayPhotos, {
      props: { photoPaths: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    expect(getByText('Progress photos')).toBeInTheDocument();
    expect(getByLabelText('Add photo')).toBeInTheDocument();
  });

  it('uploads a selected file and shows a thumbnail', async () => {
    const { uploadPhoto, getPhotoUrl } = await import('$lib/stores/photos');
    const { getByTestId, findByAltText } = render(DayPhotos, {
      props: { photoPaths: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });

    const fileInput = getByTestId('photo-file-input');
    const file = new File(['fake'], 'progress.jpg', { type: 'image/jpeg' });
    await fireEvent.change(fileInput, { target: { files: [file] } });

    expect(uploadPhoto).toHaveBeenCalledWith('user1', '2026-06-10', file);
    expect(getPhotoUrl).toHaveBeenCalled();
    expect(await findByAltText('Training day snapshot')).toBeInTheDocument();
  });

  it('a single click on the remove button arms confirmation without removing', async () => {
    const { findByAltText, getByLabelText, queryByAltText } = render(DayPhotos, {
      props: { photoPaths: ['users/user1/days/2026-06-10/existing.jpg'], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await findByAltText('Training day snapshot');
    await fireEvent.click(getByLabelText('Remove photo'));

    expect(queryByAltText('Training day snapshot')).toBeInTheDocument();
    expect(getByLabelText('Confirm remove photo')).toBeInTheDocument();
  });

  it('removes the thumbnail after a confirmed click', async () => {
    const { findByAltText, getByLabelText, queryByAltText } = render(DayPhotos, {
      props: { photoPaths: ['users/user1/days/2026-06-10/existing.jpg'], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await findByAltText('Training day snapshot');
    await fireEvent.click(getByLabelText('Remove photo'));
    await fireEvent.click(getByLabelText('Confirm remove photo'));

    expect(queryByAltText('Training day snapshot')).not.toBeInTheDocument();
  });

  it('hides the section (mobile only) when noteEditing is true', () => {
    const { getByText } = render(DayPhotos, {
      props: { photoPaths: [], readonly: false, dateKey: '2026-06-10', userId: 'user1', noteEditing: true }
    });
    const section = getByText('Progress photos').closest('div');
    expect(section?.className).toContain('hidden');
  });

  it('does not hide the section when noteEditing is false', () => {
    const { getByText } = render(DayPhotos, {
      props: { photoPaths: [], readonly: false, dateKey: '2026-06-10', userId: 'user1', noteEditing: false }
    });
    const section = getByText('Progress photos').closest('div');
    expect(section?.className).not.toContain('hidden');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/DayPhotos.test.ts`
Expected: FAIL — `Failed to resolve import "./DayPhotos.svelte"` (component doesn't exist yet).

- [ ] **Step 3: Create the component**

Create `src/lib/components/DayPhotos.svelte`:

```svelte
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
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Progress photos</span>
      <div class="flex flex-wrap gap-2">
        {#each photoPaths as path (path)}
          <button
            type="button"
            on:click={() => (lightboxUrl = photoUrls[path] ?? null)}
            disabled={!photoUrls[path]}
            class="w-20 h-20 shrink-0 bg-gb-bg2 border border-gb-bg3 overflow-hidden flex items-center justify-center"
          >
            {#if photoUrls[path]}
              <img src={photoUrls[path]} alt="Training day snapshot" class="w-full h-full object-cover" />
            {:else}
              <span class="w-4 h-4 rounded-full border-2 border-gb-bg3 border-t-gb-green animate-spin"></span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
{:else}
  <div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-2">
    <span class="text-xs text-gb-fg3 uppercase tracking-wider">Progress photos</span>
    <div class="flex flex-wrap gap-2">
      {#each photoPaths as path (path)}
        <div class="relative w-20 h-20 shrink-0 bg-gb-bg2 border border-gb-bg3">
          <button
            type="button"
            on:click={() => (lightboxUrl = photoUrls[path] ?? null)}
            disabled={!photoUrls[path]}
            class="w-full h-full flex items-center justify-center"
          >
            {#if photoUrls[path]}
              <img src={photoUrls[path]} alt="Training day snapshot" class="w-full h-full object-cover" />
            {:else}
              <span class="w-4 h-4 rounded-full border-2 border-gb-bg3 border-t-gb-green animate-spin"></span>
            {/if}
          </button>
          <button
            type="button"
            on:click={() => handleRemovePhotoClick(path)}
            aria-label={confirmingPhotoPath === path ? 'Confirm remove photo' : 'Remove photo'}
            class="absolute -top-1.5 -right-1.5 flex items-center justify-center
                   bg-gb-red text-white leading-none transition-all
                   {confirmingPhotoPath === path ? 'px-1.5 h-5 text-[10px] font-semibold' : 'w-5 h-5 text-xs'}"
          >{confirmingPhotoPath === path ? 'Sure?' : '✕'}</button>
        </div>
      {/each}

      {#if uploadingPhoto}
        <div class="w-20 h-20 shrink-0 bg-gb-bg2 border border-gb-bg3 flex items-center justify-center">
          <span class="w-4 h-4 rounded-full border-2 border-gb-bg3 border-t-gb-green animate-spin"></span>
        </div>
      {/if}

      <button
        type="button"
        on:click={triggerPhotoPicker}
        disabled={uploadingPhoto}
        aria-label="Add photo"
        class="w-20 h-20 shrink-0 border border-dashed border-gb-bg3 text-gb-fg3 text-2xl
               hover:border-gb-blue hover:text-gb-blue transition disabled:opacity-40"
      >+</button>
    </div>
    {#if photoError}
      <span class="text-xs text-gb-red">Upload failed — try again.</span>
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/DayPhotos.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/DayPhotos.svelte src/lib/components/DayPhotos.test.ts
git commit -m "feat: extract DayPhotos component from DayDetail"
```

---

### Task 2: `DayTagsField.svelte`

**Files:**
- Create: `src/lib/components/DayTagsField.svelte`
- Create: `src/lib/components/DayTagsField.test.ts`

**Interfaces:**
- Consumes: `TagChip.svelte`, `addTag` from `$lib/stores/tags`, `GRUVBOX_COLORS` from `$lib/gruvbox` (all pre-existing, unchanged).
- Produces: `DayTagsField.svelte` with props `activeTags: TrainingTag[]`, `selectedIds: Set<string>` (bindable), `userId: string = ''`, `readonly: boolean = false`, `noteEditing: boolean = false`. No events.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/DayTagsField.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DayTagsField from './DayTagsField.svelte';
import type { TrainingTag } from '$lib/types';

vi.mock('$lib/stores/tags', () => ({ addTag: vi.fn().mockResolvedValue(undefined) }));

const activeTags: TrainingTag[] = [
  { id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false },
  { id: 'tag2', name: 'Boxing', color: 'red', deleted: false },
];

describe('DayTagsField — readonly mode', () => {
  it('shows only the selected tags, not every active tag', () => {
    const { getByText, queryByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set(['tag1']), readonly: true }
    });
    expect(getByText('Weight Lifting')).toBeInTheDocument();
    expect(queryByText('Boxing')).not.toBeInTheDocument();
  });

  it('shows a placeholder message when nothing is selected', () => {
    const { getByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set(), readonly: true }
    });
    expect(getByText('Nothing logged yet.')).toBeInTheDocument();
  });

  it('does not show the "+ Add" control', () => {
    const { queryByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set(), readonly: true }
    });
    expect(queryByText('+ Add')).not.toBeInTheDocument();
  });
});

describe('DayTagsField — edit mode', () => {
  it('renders all active tag chips (not just selected ones)', () => {
    const { getByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set(['tag1']), readonly: false, userId: 'user1' }
    });
    expect(getByText('Weight Lifting')).toBeInTheDocument();
    expect(getByText('Boxing')).toBeInTheDocument();
  });

  it('clicking an unselected chip selects it', async () => {
    const { getByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set(), readonly: false, userId: 'user1' }
    });
    const chip = getByText('Boxing');
    expect(chip.style.backgroundColor).toBe('transparent');
    await fireEvent.click(chip);
    expect(chip.style.backgroundColor).not.toBe('transparent');
  });

  it('typing a new tag name and pressing Enter commits it', async () => {
    const { addTag } = await import('$lib/stores/tags');
    const { getByText, getByPlaceholderText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set(), readonly: false, userId: 'user1' }
    });
    await fireEvent.click(getByText('+ Add'));
    const input = getByPlaceholderText('Type name…');
    await fireEvent.input(input, { target: { value: 'Cycling' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(addTag).toHaveBeenCalledWith('user1', 'Cycling');
  });

  it('hides the section (mobile only) when noteEditing is true', () => {
    const { getByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set(), readonly: false, userId: 'user1', noteEditing: true }
    });
    const section = getByText('Training types').closest('div');
    expect(section?.className).toContain('hidden');
  });

  it('does not hide the section when noteEditing is false', () => {
    const { getByText } = render(DayTagsField, {
      props: { activeTags, selectedIds: new Set(), readonly: false, userId: 'user1', noteEditing: false }
    });
    const section = getByText('Training types').closest('div');
    expect(section?.className).not.toContain('hidden');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/DayTagsField.test.ts`
Expected: FAIL — `Failed to resolve import "./DayTagsField.svelte"` (component doesn't exist yet).

- [ ] **Step 3: Create the component**

Create `src/lib/components/DayTagsField.svelte`:

```svelte
<script lang="ts">
  import TagChip from './TagChip.svelte';
  import { addTag } from '$lib/stores/tags';
  import { GRUVBOX_COLORS } from '$lib/gruvbox';
  import type { TrainingTag } from '$lib/types';

  export let activeTags: TrainingTag[];
  export let selectedIds: Set<string>;
  export let userId: string = '';
  export let readonly: boolean = false;
  export let noteEditing: boolean = false;

  $: selectedTagList = activeTags.filter((t) => selectedIds.has(t.id));

  let newTagName = '';
  let addingTag = false;

  function toggleTag(tagId: string) {
    if (selectedIds.has(tagId)) selectedIds.delete(tagId);
    else selectedIds.add(tagId);
    selectedIds = selectedIds;
  }

  async function commitNewTag() {
    if (!newTagName.trim()) { addingTag = false; return; }
    await addTag(userId, newTagName.trim());
    newTagName = '';
    addingTag = false;
  }

  function autofocus(el: HTMLInputElement) {
    el.focus();
  }
</script>

{#if readonly}
  <div class="flex flex-col gap-1.5">
    <span class="text-xs text-gb-fg3 uppercase tracking-wider">Training types</span>
    {#if selectedTagList.length > 0}
      <div class="flex flex-wrap gap-3">
        {#each selectedTagList as tag (tag.id)}
          <span class="flex items-center gap-1.5 text-sm text-gb-fg">
            <span class="w-2.5 h-2.5 shrink-0" style="background-color:{GRUVBOX_COLORS[tag.color]}"></span>
            {tag.name}
          </span>
        {/each}
      </div>
    {:else}
      <p class="text-gb-fg3 text-sm italic">Nothing logged yet.</p>
    {/if}
  </div>
{:else}
  <div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-2">
    <span class="text-xs text-gb-fg3 uppercase tracking-wider">Training types</span>
    <div class="flex flex-wrap gap-2">
      {#each activeTags as tag (tag.id)}
        <TagChip {tag} selected={selectedIds.has(tag.id)} on:toggle={() => toggleTag(tag.id)} />
      {/each}

      {#if addingTag}
        <input
          type="text"
          bind:value={newTagName}
          placeholder="Type name…"
          on:keydown={(e) => e.key === 'Enter' && commitNewTag()}
          on:blur={commitNewTag}
          class="px-3 py-1 rounded-full border border-gb-bg3 bg-gb-bg2 text-gb-fg
                 text-sm focus:outline-none focus:border-gb-blue"
          use:autofocus
        />
      {:else}
        <button
          type="button"
          on:click={() => (addingTag = true)}
          class="px-3 py-1 rounded-full border border-gb-bg3 text-gb-fg3 text-sm
                 hover:border-gb-blue hover:text-gb-blue transition"
        >+ Add</button>
      {/if}
    </div>
  </div>
{/if}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/DayTagsField.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/DayTagsField.svelte src/lib/components/DayTagsField.test.ts
git commit -m "feat: extract DayTagsField component from DayDetail"
```

---

### Task 3: `DaySplitsExercises.svelte`

**Files:**
- Create: `src/lib/components/DaySplitsExercises.svelte`
- Create: `src/lib/components/DaySplitsExercises.test.ts`

**Interfaces:**
- Consumes: `ExerciseEditor.svelte`, `GRUVBOX_COLORS` from `$lib/gruvbox` (pre-existing, unchanged). `ExerciseEditor` takes `exercises`, `allDays`, `dateKey`, `userId`, `daySplitIds`, and bindable `entries` — unchanged signature.
- Produces: `DaySplitsExercises.svelte` with props `splits: PlanNote[]`, `exercises: Exercise[] = []`, `allDays: Record<string, DayEntry> = {}`, `dateKey: string = ''`, `userId: string = ''`, `selectedSplitIds: Set<string>` (bindable), `exerciseEntries: ExerciseEntry[]` (bindable), `readonly: boolean = false`, `noteEditing: boolean = false`. No events.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/DaySplitsExercises.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DaySplitsExercises from './DaySplitsExercises.svelte';
import type { Exercise, PlanNote } from '$lib/types';

vi.mock('$lib/stores/exercises', () => ({
  addExercise: vi.fn().mockResolvedValue('new-ex-id'),
}));

const exercises: Exercise[] = [{ id: 'bench', name: 'Bench Press', deleted: false }];
const splits: PlanNote[] = [
  { id: 'push', label: 'Push Day', sortOrder: 1, content: '', color: 'blue' },
  { id: 'pull', label: 'Pull Day', sortOrder: 2, content: '', color: 'red' },
];

describe('DaySplitsExercises — readonly mode', () => {
  it('shows selected splits, not unselected ones', () => {
    const { getByText, queryByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set(['push']), exerciseEntries: [], readonly: true }
    });
    expect(getByText('Push Day')).toBeInTheDocument();
    expect(queryByText('Pull Day')).not.toBeInTheDocument();
  });

  it('shows nothing when there are no splits or exercises logged', () => {
    const { queryByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set(), exerciseEntries: [], readonly: true }
    });
    expect(queryByText('Splits')).not.toBeInTheDocument();
    expect(queryByText('Exercises')).not.toBeInTheDocument();
  });

  it('shows logged exercises with sets', () => {
    const { getByText } = render(DaySplitsExercises, {
      props: {
        splits, exercises, selectedSplitIds: new Set(),
        exerciseEntries: [{ exerciseId: 'bench', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 6 }] }],
        readonly: true
      }
    });
    expect(getByText('Bench Press')).toBeInTheDocument();
    expect(getByText(/80×8, 80×6/)).toBeInTheDocument();
  });
});

describe('DaySplitsExercises — edit mode', () => {
  it('starts collapsed when there is no split or exercise logged yet', () => {
    const { queryByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    expect(queryByText('Push Day')).not.toBeInTheDocument();
  });

  it('starts expanded when a split is already selected', () => {
    const { getByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set(['push']), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    expect(getByText('Push Day')).toBeInTheDocument();
  });

  it('expands on header click to reveal the split picker and exercise editor', async () => {
    const { getByText } = render(DaySplitsExercises, {
      props: { splits, exercises, selectedSplitIds: new Set(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await fireEvent.click(getByText('Splits & Exercises'));
    expect(getByText('Push Day')).toBeInTheDocument();
    expect(getByText('+ Bench Press')).toBeInTheDocument();
  });

  it('toggling a split chip selects it', async () => {
    const { getByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await fireEvent.click(getByText('Splits & Exercises'));
    const pushChip = getByText('Push Day');
    await fireEvent.click(pushChip);
    expect(pushChip.className).toContain('border-gb-green');
  });

  it('picking a split narrows the exercise picker', async () => {
    const tiedExercises: Exercise[] = [
      { id: 'bench', name: 'Bench Press', deleted: false, splitIds: ['push'] },
      { id: 'row', name: 'Row', deleted: false, splitIds: ['pull'] },
    ];
    const { getByText, queryByText } = render(DaySplitsExercises, {
      props: { splits, exercises: tiedExercises, selectedSplitIds: new Set(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await fireEvent.click(getByText('Splits & Exercises'));
    expect(getByText('+ Bench Press')).toBeInTheDocument();
    expect(getByText('+ Row')).toBeInTheDocument();

    await fireEvent.click(getByText('Push Day'));

    expect(getByText('+ Bench Press')).toBeInTheDocument();
    expect(queryByText('+ Row')).not.toBeInTheDocument();
  });

  it('logging a set via the exercise editor is reflected immediately', async () => {
    const { getByText } = render(DaySplitsExercises, {
      props: { splits, exercises, selectedSplitIds: new Set(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1' }
    });
    await fireEvent.click(getByText('Splits & Exercises'));
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('20×8 ✕')).toBeInTheDocument();
  });

  it('hides the section (mobile only) when noteEditing is true', () => {
    const { getByText } = render(DaySplitsExercises, {
      props: { splits, selectedSplitIds: new Set(), exerciseEntries: [], readonly: false, dateKey: '2026-06-10', userId: 'user1', noteEditing: true }
    });
    const section = getByText('Splits & Exercises').closest('div');
    expect(section?.className).toContain('hidden');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/DaySplitsExercises.test.ts`
Expected: FAIL — `Failed to resolve import "./DaySplitsExercises.svelte"` (component doesn't exist yet).

- [ ] **Step 3: Create the component**

Create `src/lib/components/DaySplitsExercises.svelte`:

```svelte
<script lang="ts">
  import { slide } from 'svelte/transition';
  import ExerciseEditor from './ExerciseEditor.svelte';
  import { GRUVBOX_COLORS } from '$lib/gruvbox';
  import type { Exercise, ExerciseEntry, PlanNote, DayEntry } from '$lib/types';

  export let splits: PlanNote[];
  export let exercises: Exercise[] = [];
  export let allDays: Record<string, DayEntry> = {};
  export let dateKey: string = '';
  export let userId: string = '';
  export let selectedSplitIds: Set<string>;
  export let exerciseEntries: ExerciseEntry[];
  export let readonly: boolean = false;
  export let noteEditing: boolean = false;

  $: selectedSplitList = splits.filter((s) => selectedSplitIds.has(s.id));
  $: exerciseNameById = Object.fromEntries(exercises.map((e) => [e.id, e.name]));

  function toggleSplit(splitId: string) {
    if (selectedSplitIds.has(splitId)) selectedSplitIds.delete(splitId);
    else selectedSplitIds.add(splitId);
    selectedSplitIds = selectedSplitIds;
  }

  // Not every day has a split/exercise logged — start collapsed unless there's
  // already something there, so an empty day's edit form isn't so tall.
  let splitsExpanded = selectedSplitIds.size > 0 || exerciseEntries.length > 0;
</script>

{#if readonly}
  {#if selectedSplitList.length > 0}
    <div class="flex flex-col gap-1.5">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Splits</span>
      <div class="flex flex-wrap gap-3">
        {#each selectedSplitList as split (split.id)}
          <span class="flex items-center gap-1.5 text-sm text-gb-fg">
            <span class="w-2.5 h-2.5 shrink-0" style="background-color:{GRUVBOX_COLORS[split.color ?? 'blue']}"></span>
            {split.label || 'Untitled'}
          </span>
        {/each}
      </div>
    </div>
  {/if}

  {#if exerciseEntries.length > 0}
    <div class="flex flex-col gap-1.5">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Exercises</span>
      <div class="flex flex-col gap-1">
        {#each exerciseEntries as ex (ex.exerciseId)}
          <p class="text-sm text-gb-fg">
            <span class="font-medium">{exerciseNameById[ex.exerciseId] ?? 'Unknown exercise'}</span>
            {#if ex.sets.length > 0}
              <span class="text-gb-fg3"> — {ex.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')}</span>
            {:else}
              <span class="text-gb-fg3 italic"> — no sets logged</span>
            {/if}
          </p>
        {/each}
      </div>
    </div>
  {/if}
{:else}
  <div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-2">
    <button
      type="button"
      on:click={() => (splitsExpanded = !splitsExpanded)}
      class="flex items-center justify-between text-xs text-gb-fg3 uppercase tracking-wider"
    >
      <span>Splits & Exercises</span>
      <span class="text-sm leading-none">{splitsExpanded ? '−' : '+'}</span>
    </button>
    {#if splitsExpanded}
      <div class="flex flex-col gap-3" transition:slide={{ duration: 200 }}>
        <div class="flex flex-col gap-2">
          <span class="text-xs text-gb-fg3 uppercase tracking-wider">Splits</span>
          <div class="flex flex-wrap gap-2">
            {#each splits as split (split.id)}
              <button
                type="button"
                on:click={() => toggleSplit(split.id)}
                class="px-3 py-1 rounded-full border text-sm transition
                       {selectedSplitIds.has(split.id)
                         ? 'border-gb-green text-gb-green bg-gb-bg2'
                         : 'border-gb-bg3 text-gb-fg3 hover:border-gb-blue hover:text-gb-blue'}"
              >{split.label || 'Untitled'}</button>
            {/each}
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-xs text-gb-fg3 uppercase tracking-wider">Exercises</span>
          <ExerciseEditor {exercises} {allDays} {dateKey} {userId} daySplitIds={[...selectedSplitIds]} bind:entries={exerciseEntries} />
        </div>
      </div>
    {/if}
  </div>
{/if}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/DaySplitsExercises.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/DaySplitsExercises.svelte src/lib/components/DaySplitsExercises.test.ts
git commit -m "feat: extract DaySplitsExercises component from DayDetail"
```

---

### Task 4: `DayDetailView.svelte`

**Files:**
- Create: `src/lib/components/DayDetailView.svelte`
- Create: `src/lib/components/DayDetailViewTest.svelte`
- Create: `src/lib/components/DayDetailView.test.ts`

**Interfaces:**
- Consumes: `DayTagsField.svelte` (Task 2, props `activeTags`, `selectedIds`, `readonly`), `DaySplitsExercises.svelte` (Task 3, props `splits`, `exercises`, `selectedSplitIds`, `exerciseEntries`, `readonly`), `DayPhotos.svelte` (Task 1, props `photoPaths`, `readonly`), `icons.pencilSm` from `$lib/icons` (pre-existing), `marked` (pre-existing).
- Produces: `DayDetailView.svelte` with props `activeTags: TrainingTag[]`, `selectedIds: Set<string>`, `splits: PlanNote[]`, `selectedSplitIds: Set<string>`, `exercises: Exercise[] = []`, `exerciseEntries: ExerciseEntry[]`, `label: string`, `activeTasks: DailyTask[] = []`, `completedTaskIds: Set<string>`, `note: string`, `photoPaths: string[]`. Dispatches `edit` (no payload). Used by `DayDetail.svelte` in Task 6.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/DayDetailViewTest.svelte` (test-only wrapper to observe the `edit` event, following the existing `DayModalTest.svelte`/`TagChipTest.svelte` pattern):

```svelte
<script lang="ts">
  import DayDetailView from './DayDetailView.svelte';
  import type { TrainingTag, DailyTask, Exercise, ExerciseEntry, PlanNote } from '$lib/types';

  export let activeTags: TrainingTag[];
  export let selectedIds: Set<string> = new Set();
  export let splits: PlanNote[] = [];
  export let selectedSplitIds: Set<string> = new Set();
  export let exercises: Exercise[] = [];
  export let exerciseEntries: ExerciseEntry[] = [];
  export let label: string = '';
  export let activeTasks: DailyTask[] = [];
  export let completedTaskIds: Set<string> = new Set();
  export let note: string = '';
  export let photoPaths: string[] = [];

  let editCount = 0;
  function handleEdit() {
    editCount += 1;
  }
</script>

<DayDetailView
  {activeTags} {selectedIds} {splits} {selectedSplitIds} {exercises} {exerciseEntries}
  {label} {activeTasks} {completedTaskIds} {note} {photoPaths}
  on:edit={handleEdit}
/>

<div data-testid="event-info">
  <div data-testid="edit-count">{editCount}</div>
</div>
```

Create `src/lib/components/DayDetailView.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DayDetailView from './DayDetailView.svelte';
import DayDetailViewTest from './DayDetailViewTest.svelte';
import type { TrainingTag, DailyTask } from '$lib/types';

vi.mock('marked', () => ({ marked: (s: string) => s }));

const activeTags: TrainingTag[] = [{ id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false }];
const activeTasks: DailyTask[] = [{ id: 'task1', name: 'Stretch', deleted: false }];

function baseProps(overrides = {}) {
  return {
    activeTags, selectedIds: new Set<string>(), splits: [], selectedSplitIds: new Set<string>(),
    exercises: [], exerciseEntries: [], label: '', activeTasks: [], completedTaskIds: new Set<string>(),
    note: '', photoPaths: [], ...overrides
  };
}

describe('DayDetailView', () => {
  it('shows the label as text', () => {
    const { getByText } = render(DayDetailView, { props: baseProps({ label: 'Leg day' }) });
    expect(getByText('Leg day')).toBeInTheDocument();
  });

  it('does not show a Label section when empty', () => {
    const { queryByText } = render(DayDetailView, { props: baseProps({ label: '' }) });
    expect(queryByText('Label')).not.toBeInTheDocument();
  });

  it('shows daily tasks with completed state, read-only', () => {
    const { getByText } = render(DayDetailView, {
      props: baseProps({ activeTasks, completedTaskIds: new Set(['task1']) })
    });
    const stretchRow = getByText('Stretch').closest('span');
    expect(stretchRow?.textContent).toContain('✓');
  });

  it('does not show a Daily tasks section when there are no active tasks', () => {
    const { queryByText } = render(DayDetailView, { props: baseProps({ activeTasks: [] }) });
    expect(queryByText('Daily tasks')).not.toBeInTheDocument();
  });

  it('renders the note as markdown', () => {
    const { getByText } = render(DayDetailView, { props: baseProps({ note: '# PR' }) });
    expect(getByText('# PR')).toBeInTheDocument();
  });

  it('shows a placeholder when there are no notes', () => {
    const { getByText } = render(DayDetailView, { props: baseProps({ note: '' }) });
    expect(getByText('No notes yet.')).toBeInTheDocument();
  });

  it('shows an Edit button and dispatches edit on click', async () => {
    const { getByText, getByTestId } = render(DayDetailViewTest, { props: baseProps() });
    await fireEvent.click(getByText('Edit'));
    expect(getByTestId('edit-count').textContent).toBe('1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/DayDetailView.test.ts`
Expected: FAIL — `Failed to resolve import "./DayDetailView.svelte"` (component doesn't exist yet).

- [ ] **Step 3: Create the component**

Create `src/lib/components/DayDetailView.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { marked } from 'marked';
  import DayTagsField from './DayTagsField.svelte';
  import DaySplitsExercises from './DaySplitsExercises.svelte';
  import DayPhotos from './DayPhotos.svelte';
  import { icons } from '$lib/icons';
  import type { TrainingTag, DailyTask, Exercise, ExerciseEntry, PlanNote } from '$lib/types';

  export let activeTags: TrainingTag[];
  export let selectedIds: Set<string>;
  export let splits: PlanNote[];
  export let selectedSplitIds: Set<string>;
  export let exercises: Exercise[] = [];
  export let exerciseEntries: ExerciseEntry[];
  export let label: string;
  export let activeTasks: DailyTask[] = [];
  export let completedTaskIds: Set<string>;
  export let note: string;
  export let photoPaths: string[];

  const dispatch = createEventDispatcher<{ edit: void }>();
</script>

<div class="flex flex-col gap-4">
  <DayTagsField {activeTags} {selectedIds} readonly={true} />

  <DaySplitsExercises {splits} {exercises} {selectedSplitIds} {exerciseEntries} readonly={true} />

  {#if label}
    <div class="flex flex-col gap-1">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Label</span>
      <p class="text-sm text-gb-fg">{label}</p>
    </div>
  {/if}

  {#if activeTasks.length > 0}
    <div class="flex flex-col gap-1.5">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Daily tasks</span>
      <div class="flex flex-col gap-1">
        {#each activeTasks as task (task.id)}
          <span class="text-sm flex items-center gap-2 {completedTaskIds.has(task.id) ? 'text-gb-fg' : 'text-gb-fg3'}">
            <span>{completedTaskIds.has(task.id) ? '✓' : '○'}</span>
            {task.name}
          </span>
        {/each}
      </div>
    </div>
  {/if}

  <div class="flex flex-col gap-1">
    <span class="text-xs text-gb-fg3 uppercase tracking-wider">Notes</span>
    {#if note}
      <div class="prose prose-invert max-w-none text-sm text-gb-fg
                  [&_h1]:text-gb-green [&_h2]:text-gb-green [&_h3]:text-gb-green
                  [&_strong]:text-gb-orange [&_a]:text-gb-blue">
        {@html marked(note)}
      </div>
    {:else}
      <p class="text-gb-fg3 text-sm italic">No notes yet.</p>
    {/if}
  </div>

  <DayPhotos {photoPaths} readonly={true} />

  <button
    type="button"
    on:click={() => dispatch('edit')}
    class="self-end flex items-center gap-1.5 bg-gb-blue text-gb-bg font-semibold text-sm px-4 py-2 hover:opacity-90 transition"
  >{@html icons.pencilSm}Edit</button>
</div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/DayDetailView.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/DayDetailView.svelte src/lib/components/DayDetailViewTest.svelte src/lib/components/DayDetailView.test.ts
git commit -m "feat: add DayDetailView component composing the read-only DayDetail fields"
```

---

### Task 5: `DayDetailEditForm.svelte`

**Files:**
- Create: `src/lib/components/DayDetailEditForm.svelte`
- Create: `src/lib/components/DayDetailEditFormTest.svelte`
- Create: `src/lib/components/DayDetailEditForm.test.ts`

**Interfaces:**
- Consumes: `DayTagsField.svelte` (Task 2), `DaySplitsExercises.svelte` (Task 3), `DayPhotos.svelte` (Task 1) in edit mode (`readonly` omitted, defaults to `false`); `FormField.svelte` (pre-existing, props `id`, `label`, `placeholder`, bindable `value`); `MarkdownEditor.svelte` (pre-existing, bindable `value`/`mode` props).
- Produces: `DayDetailEditForm.svelte` with props `dateKey: string`, `userId: string`, `activeTags: TrainingTag[]`, `selectedIds: Set<string>` (bindable), `splits: PlanNote[]`, `selectedSplitIds: Set<string>` (bindable), `exercises: Exercise[] = []`, `allDays: Record<string, DayEntry> = {}`, `exerciseEntries: ExerciseEntry[]` (bindable), `label: string` (bindable), `activeTasks: DailyTask[] = []`, `completedTaskIds: Set<string>` (bindable), `note: string` (bindable), `noteMode: 'edit' | 'preview'` (bindable), `photoPaths: string[]` (bindable), `hideOtherSectionsWhileEditingNote: boolean = true`, `saving: boolean`, `saved: boolean`. Dispatches `save`, `cancel` (no payload). Used by `DayDetail.svelte` in Task 6.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/DayDetailEditFormTest.svelte` (test-only wrapper to observe `save`/`cancel` events, following the existing `DayModalTest.svelte` pattern):

```svelte
<script lang="ts">
  import DayDetailEditForm from './DayDetailEditForm.svelte';
  import type { TrainingTag, DailyTask, Exercise, ExerciseEntry, PlanNote, DayEntry } from '$lib/types';

  export let dateKey: string;
  export let userId: string;
  export let activeTags: TrainingTag[];
  export let selectedIds: Set<string> = new Set();
  export let splits: PlanNote[] = [];
  export let selectedSplitIds: Set<string> = new Set();
  export let exercises: Exercise[] = [];
  export let allDays: Record<string, DayEntry> = {};
  export let exerciseEntries: ExerciseEntry[] = [];
  export let label: string = '';
  export let activeTasks: DailyTask[] = [];
  export let completedTaskIds: Set<string> = new Set();
  export let note: string = '';
  export let noteMode: 'edit' | 'preview' = 'preview';
  export let photoPaths: string[] = [];
  export let hideOtherSectionsWhileEditingNote = true;
  export let saving: boolean = false;
  export let saved: boolean = false;

  let saveCount = 0;
  let cancelCount = 0;
</script>

<DayDetailEditForm
  {dateKey} {userId} {activeTags} bind:selectedIds {splits} bind:selectedSplitIds {exercises} {allDays}
  bind:exerciseEntries bind:label {activeTasks} bind:completedTaskIds bind:note bind:noteMode bind:photoPaths
  {hideOtherSectionsWhileEditingNote} {saving} {saved}
  on:save={() => (saveCount += 1)}
  on:cancel={() => (cancelCount += 1)}
/>

<div data-testid="event-info">
  <div data-testid="save-count">{saveCount}</div>
  <div data-testid="cancel-count">{cancelCount}</div>
</div>
```

Create `src/lib/components/DayDetailEditForm.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DayDetailEditFormTest from './DayDetailEditFormTest.svelte';
import type { TrainingTag, DailyTask } from '$lib/types';

vi.mock('$lib/stores/tags', () => ({ addTag: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/photos', () => ({
  uploadPhoto: vi.fn().mockResolvedValue('users/user1/days/2026-06-10/photo.jpg'),
  getPhotoUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
}));

const activeTags: TrainingTag[] = [{ id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false }];
const activeTasks: DailyTask[] = [
  { id: 'task1', name: 'Stretch', deleted: false },
  { id: 'task2', name: 'Drink water', deleted: false },
];

function baseProps(overrides = {}) {
  return {
    dateKey: '2026-06-10', userId: 'user1', activeTags, selectedIds: new Set<string>(),
    splits: [], selectedSplitIds: new Set<string>(), exercises: [], allDays: {},
    exerciseEntries: [], label: '', activeTasks: [], completedTaskIds: new Set<string>(),
    note: '', noteMode: 'preview' as const, photoPaths: [], saving: false, saved: false, ...overrides
  };
}

describe('DayDetailEditForm — daily tasks', () => {
  it('does not render a Daily tasks section when there are no active tasks', () => {
    const { queryByText } = render(DayDetailEditFormTest, { props: baseProps() });
    expect(queryByText('Daily tasks')).not.toBeInTheDocument();
  });

  it('renders a checkbox per active task, pre-checked from completedTaskIds', () => {
    const { getByLabelText } = render(DayDetailEditFormTest, {
      props: baseProps({ activeTasks, completedTaskIds: new Set(['task1']) })
    });
    expect(getByLabelText('Stretch')).toBeChecked();
    expect(getByLabelText('Drink water')).not.toBeChecked();
  });

  it('toggles a task checkbox on click', async () => {
    const { getByLabelText } = render(DayDetailEditFormTest, { props: baseProps({ activeTasks }) });
    const checkbox = getByLabelText('Drink water');
    await fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});

describe('DayDetailEditForm — note-editing hides other sections (mobile only)', () => {
  it('hides other sections while the note is in edit mode', () => {
    const { getByText } = render(DayDetailEditFormTest, {
      props: baseProps({ activeTags, activeTasks, noteMode: 'edit' })
    });
    const trainingTypesSection = getByText('Training types').closest('div');
    const photosSection = getByText('Progress photos').closest('div');
    expect(trainingTypesSection?.className).toContain('hidden');
    expect(photosSection?.className).toContain('hidden');
  });

  it('does not hide other sections when hideOtherSectionsWhileEditingNote is false', () => {
    const { getByText } = render(DayDetailEditFormTest, {
      props: baseProps({ activeTags, noteMode: 'edit', hideOtherSectionsWhileEditingNote: false })
    });
    const trainingTypesSection = getByText('Training types').closest('div');
    expect(trainingTypesSection?.className).not.toContain('hidden');
  });

  it('does not hide other sections when the note is in preview mode', () => {
    const { getByText } = render(DayDetailEditFormTest, {
      props: baseProps({ activeTags, noteMode: 'preview' })
    });
    const trainingTypesSection = getByText('Training types').closest('div');
    expect(trainingTypesSection?.className).not.toContain('hidden');
  });
});

describe('DayDetailEditForm — save/cancel', () => {
  it('dispatches save on Save click', async () => {
    const { getByText, getByTestId } = render(DayDetailEditFormTest, { props: baseProps() });
    await fireEvent.click(getByText('Save'));
    expect(getByTestId('save-count').textContent).toBe('1');
  });

  it('dispatches cancel on Cancel click', async () => {
    const { getByText, getByTestId } = render(DayDetailEditFormTest, { props: baseProps() });
    await fireEvent.click(getByText('Cancel'));
    expect(getByTestId('cancel-count').textContent).toBe('1');
  });

  it('shows a Saving state when saving is true', () => {
    const { getByText } = render(DayDetailEditFormTest, { props: baseProps({ saving: true }) });
    expect(getByText('Saving…')).toBeInTheDocument();
  });

  it('shows a Saved state when saved is true', () => {
    const { getByText } = render(DayDetailEditFormTest, { props: baseProps({ saved: true }) });
    expect(getByText('✓ Saved')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/DayDetailEditForm.test.ts`
Expected: FAIL — `Failed to resolve import "./DayDetailEditForm.svelte"` (component doesn't exist yet).

- [ ] **Step 3: Create the component**

Create `src/lib/components/DayDetailEditForm.svelte`:

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import MarkdownEditor from './MarkdownEditor.svelte';
  import FormField from './FormField.svelte';
  import DayTagsField from './DayTagsField.svelte';
  import DaySplitsExercises from './DaySplitsExercises.svelte';
  import DayPhotos from './DayPhotos.svelte';
  import type { TrainingTag, DailyTask, Exercise, ExerciseEntry, PlanNote, DayEntry } from '$lib/types';

  export let dateKey: string;
  export let userId: string;
  export let activeTags: TrainingTag[];
  export let selectedIds: Set<string>;
  export let splits: PlanNote[];
  export let selectedSplitIds: Set<string>;
  export let exercises: Exercise[] = [];
  export let allDays: Record<string, DayEntry> = {};
  export let exerciseEntries: ExerciseEntry[];
  export let label: string;
  export let activeTasks: DailyTask[] = [];
  export let completedTaskIds: Set<string>;
  export let note: string;
  export let noteMode: 'edit' | 'preview';
  export let photoPaths: string[];
  export let hideOtherSectionsWhileEditingNote = true;
  export let saving: boolean;
  export let saved: boolean;

  const dispatch = createEventDispatcher<{ save: void; cancel: void }>();

  $: noteEditing = hideOtherSectionsWhileEditingNote && noteMode === 'edit';

  function toggleTask(taskId: string) {
    if (completedTaskIds.has(taskId)) completedTaskIds.delete(taskId);
    else completedTaskIds.add(taskId);
    completedTaskIds = completedTaskIds;
  }
</script>

<DayTagsField {activeTags} bind:selectedIds {userId} {noteEditing} />

<DaySplitsExercises {splits} {exercises} {allDays} {dateKey} {userId} bind:selectedSplitIds bind:exerciseEntries {noteEditing} />

<!-- Label -->
<div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-1">
  <FormField id="day-label" label="Label" placeholder="Short label shown on calendar" bind:value={label} />
</div>

<!-- Daily tasks -->
{#if activeTasks.length > 0}
  <div class="{noteEditing ? 'hidden md:flex' : 'flex'} flex-col gap-2">
    <span class="text-xs text-gb-fg3 uppercase tracking-wider">Daily tasks</span>
    <div class="flex flex-col gap-1.5">
      {#each activeTasks as task (task.id)}
        <label class="flex items-center gap-2.5 text-sm text-gb-fg cursor-pointer">
          <input
            type="checkbox"
            checked={completedTaskIds.has(task.id)}
            on:change={() => toggleTask(task.id)}
            class="w-4 h-4 accent-gb-green shrink-0"
          />
          {task.name}
        </label>
      {/each}
    </div>
  </div>
{/if}

<!-- Notes -->
<div class="flex flex-col gap-1">
  <span class="text-xs text-gb-fg3 uppercase tracking-wider">Notes</span>
  <MarkdownEditor bind:value={note} bind:mode={noteMode} placeholder="Bodyweight, PRs, observations…" rows={6} />
</div>

<DayPhotos bind:photoPaths {dateKey} {userId} {noteEditing} />

<div class="flex justify-end gap-2">
  <button
    type="button"
    on:click={() => dispatch('cancel')}
    disabled={saving}
    class="text-gb-fg3 text-sm hover:text-gb-fg transition px-3 py-2"
  >Cancel</button>
  <button
    type="button"
    on:click={() => dispatch('save')}
    disabled={saving || saved}
    class="flex-1 bg-gb-green text-gb-bg font-semibold py-2.5 rounded-md
           transition-transform hover:opacity-90 active:scale-[0.98]
           disabled:opacity-90 flex items-center justify-center gap-2"
  >
    {#if saved}
      <span>✓ Saved</span>
    {:else if saving}
      <span class="w-4 h-4 rounded-full border-2 border-gb-bg border-t-transparent animate-spin"></span>
      <span>Saving…</span>
    {:else}
      <span>Save</span>
    {/if}
  </button>
</div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/DayDetailEditForm.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/DayDetailEditForm.svelte src/lib/components/DayDetailEditFormTest.svelte src/lib/components/DayDetailEditForm.test.ts
git commit -m "feat: add DayDetailEditForm component composing the editable DayDetail fields"
```

---

### Task 6: Rewrite `DayDetail.svelte` as the orchestrator

**Files:**
- Modify: `src/lib/components/DayDetail.svelte` (full rewrite)
- Modify: `src/lib/components/DayDetail.test.ts` (full rewrite — trims to an integration suite)

**Interfaces:**
- Consumes: `DayDetailView.svelte` (Task 4), `DayDetailEditForm.svelte` (Task 5), `saveDay` from `$lib/stores/days` (pre-existing, unchanged), `deletePhoto` from `$lib/stores/photos` (pre-existing, unchanged).
- Produces: `DayDetail.svelte` — **external interface unchanged** from today (see Global Constraints). Consumed by `DayModal.svelte` (unmodified), `src/routes/+page.svelte` (unmodified), `src/routes/calendar/+page.svelte` (unmodified).

- [ ] **Step 1: Replace `DayDetail.svelte`'s contents**

Replace the entire contents of `src/lib/components/DayDetail.svelte` with:

```svelte
<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import DayDetailView from './DayDetailView.svelte';
  import DayDetailEditForm from './DayDetailEditForm.svelte';
  import { saveDay } from '$lib/stores/days';
  import { deletePhoto } from '$lib/stores/photos';
  import type { TrainingTag, DailyTask, Exercise, ExerciseEntry, PlanNote, DayEntry } from '$lib/types';

  export let dateKey: string;      // YYYY-MM-DD
  export let entry: DayEntry;
  export let activeTags: TrainingTag[];
  export let activeTasks: DailyTask[] = [];
  export let exercises: Exercise[] = []; // full list (incl. deleted) so old logs still resolve names
  export let splits: PlanNote[] = [];
  export let allDays: Record<string, DayEntry> = {};
  export let userId: string;
  // Only useful in a height-constrained modal sheet — the inline Home page
  // has no such constraint, so it opts out.
  export let hideOtherSectionsWhileEditingNote = true;

  const dispatch = createEventDispatcher<{ saved: void }>();

  let selectedIds = new Set<string>(entry.tags);
  let selectedSplitIds = new Set<string>(entry.splitIds ?? []);
  let completedTaskIds = new Set<string>(entry.tasks ?? []);
  let label = entry.label;
  let note = entry.note;
  let noteMode: 'edit' | 'preview' = note ? 'preview' : 'edit';
  let saving = false;
  let saved = false;
  let savedResetTimeout: ReturnType<typeof setTimeout> | null = null;

  function cloneExerciseEntries(list: ExerciseEntry[] | undefined): ExerciseEntry[] {
    return (list ?? []).map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map((s) => ({ ...s })) }));
  }

  let exerciseEntries: ExerciseEntry[] = cloneExerciseEntries(entry.exercises);

  // Photos: uploads commit to Storage immediately (need a real ref to preview),
  // but removals only take effect on Save, so discarding edits still works.
  const originalPhotoPaths = entry.photos ?? [];
  let photoPaths = [...originalPhotoPaths];

  function hasAnyContent(): boolean {
    return selectedIds.size > 0 || selectedSplitIds.size > 0 || !!label.trim() || !!note.trim()
      || completedTaskIds.size > 0 || photoPaths.length > 0 || exerciseEntries.length > 0;
  }

  // View mode by default for a day that already has something logged —
  // jumping straight into an editable form every time feels heavy-handed.
  let mode: 'view' | 'edit' = hasAnyContent() ? 'view' : 'edit';

  onDestroy(() => {
    if (savedResetTimeout) clearTimeout(savedResetTimeout);
  });

  function startEdit() {
    mode = 'edit';
    noteMode = 'edit';
  }

  function cancelEdit() {
    selectedIds = new Set(entry.tags);
    selectedSplitIds = new Set(entry.splitIds ?? []);
    completedTaskIds = new Set(entry.tasks ?? []);
    label = entry.label;
    note = entry.note;
    noteMode = note ? 'preview' : 'edit';
    photoPaths = [...originalPhotoPaths];
    exerciseEntries = cloneExerciseEntries(entry.exercises);
    mode = hasAnyContent() ? 'view' : 'edit';
  }

  async function handleSave() {
    if (saving || saved) return;
    saving = true;
    try {
      const removedPaths = originalPhotoPaths.filter((p) => !photoPaths.includes(p));
      await saveDay(userId, dateKey, {
        tags: [...selectedIds], label, note, tasks: [...completedTaskIds], photos: photoPaths,
        exercises: exerciseEntries, splitIds: [...selectedSplitIds]
      });
      await Promise.all(
        removedPaths.map((p) => deletePhoto(p).catch((err) => console.error('[DayDetail] failed to delete photo:', err)))
      );
      saving = false;
      saved = true;
      dispatch('saved');
      if (savedResetTimeout) clearTimeout(savedResetTimeout);
      savedResetTimeout = setTimeout(() => {
        saved = false;
        mode = 'view';
      }, 1500);
    } catch (err) {
      saving = false;
      console.error('[DayDetail] save failed:', err);
    }
  }
</script>

{#if mode === 'view'}
  <DayDetailView
    {activeTags} {selectedIds} {splits} {selectedSplitIds} {exercises} {exerciseEntries}
    {label} {activeTasks} {completedTaskIds} {note} {photoPaths}
    on:edit={startEdit}
  />
{:else}
  <DayDetailEditForm
    {dateKey} {userId} {activeTags} bind:selectedIds {splits} bind:selectedSplitIds {exercises} {allDays}
    bind:exerciseEntries bind:label {activeTasks} bind:completedTaskIds bind:note bind:noteMode bind:photoPaths
    {hideOtherSectionsWhileEditingNote} {saving} {saved}
    on:save={handleSave} on:cancel={cancelEdit}
  />
{/if}
```

- [ ] **Step 2: Replace `DayDetail.test.ts`'s contents**

Replace the entire contents of `src/lib/components/DayDetail.test.ts` with (this trims ~40 tests down to an integration suite — the removed cases now live in `DayTagsField.test.ts`, `DaySplitsExercises.test.ts`, `DayPhotos.test.ts`, `DayDetailView.test.ts`, and `DayDetailEditForm.test.ts` from Tasks 1-5):

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import DayDetail from './DayDetail.svelte';
import DayDetailTest from './DayDetailTest.svelte';
import type { TrainingTag, DailyTask, DayEntry } from '$lib/types';

vi.mock('$lib/stores/days', () => ({ saveDay: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/tags', () => ({ addTag: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/photos', () => ({
  uploadPhoto: vi.fn().mockResolvedValue('users/user1/days/2026-06-10/photo.jpg'),
  getPhotoUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
  deletePhoto: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('$lib/stores/exercises', () => ({
  addExercise: vi.fn().mockResolvedValue('new-ex-id'),
}));
vi.mock('marked', () => ({ marked: (s: string) => s }));

const activeTags: TrainingTag[] = [
  { id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false },
  { id: 'tag2', name: 'Boxing', color: 'red', deleted: false },
];
const activeTasks: DailyTask[] = [
  { id: 'task1', name: 'Stretch', deleted: false },
  { id: 'task2', name: 'Drink water', deleted: false },
];
const exercises = [
  { id: 'bench', name: 'Bench Press', deleted: false },
];
const splits = [
  { id: 'push', label: 'Push Day', sortOrder: 1, content: '', color: 'blue' as const },
  { id: 'pull', label: 'Pull Day', sortOrder: 2, content: '', color: 'red' as const },
];
const entry: DayEntry = { tags: ['tag1'], label: 'Leg day', note: '# PR', tasks: ['task1'] };
const emptyEntry: DayEntry = { tags: [], label: '', note: '' };

describe('DayDetail — mode', () => {
  it('defaults to view mode with an Edit button when the day already has content', () => {
    const { getByText, queryByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByText('Edit')).toBeInTheDocument();
    expect(queryByText('Save')).not.toBeInTheDocument();
    expect(getByText('Leg day')).toBeInTheDocument();
  });

  it('defaults to edit mode, no Edit button needed, when the day is empty', () => {
    const { getByText, getByPlaceholderText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry: emptyEntry, activeTags, userId: 'user1' }
    });
    expect(getByPlaceholderText('Short label shown on calendar')).toBeInTheDocument();
    expect(getByText('Save')).toBeInTheDocument();
  });

  it('clicking Edit switches to the editable form', async () => {
    const { getByText, getByDisplayValue } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    expect(getByDisplayValue('Leg day')).toBeInTheDocument();
    expect(getByText('Save')).toBeInTheDocument();
  });

  it('clicking Edit opens the note editor in edit mode even though it has content', async () => {
    // entry.note is non-empty, so MarkdownEditor would normally default to preview
    const { getByText, getByPlaceholderText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    expect(getByPlaceholderText('Bodyweight, PRs, observations…')).toBeInTheDocument();
    expect(getByText('Preview')).toBeInTheDocument(); // toggle button confirms we're in edit mode
  });
});

describe('DayDetail — save/cancel orchestration', () => {
  async function renderInEditMode(props: ComponentProps<DayDetail>) {
    const utils = render(DayDetail, { props });
    await fireEvent.click(utils.getByText('Edit'));
    return utils;
  }

  it('calls saveDay with correct args on Save click', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { getByText } = await renderInEditMode({ dateKey: '2026-06-10', entry, activeTags, userId: 'user1' });
    await fireEvent.click(getByText('Save'));
    expect(saveDay).toHaveBeenCalledWith('user1', '2026-06-10', expect.objectContaining({ label: 'Leg day' }));
  });

  it('emits saved after save resolves', async () => {
    const utils = render(DayDetailTest, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(utils.getByText('Edit'));
    await fireEvent.click(utils.getByText('Save'));
    await waitFor(() => {
      expect(Number(utils.getByTestId('saved-count').textContent)).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows a Saving then Saved state, then returns to view mode', async () => {
    const { saveDay } = await import('$lib/stores/days');
    let resolveSave = () => {};
    (saveDay as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveSave = resolve; })
    );

    const { getByText } = await renderInEditMode({ dateKey: '2026-06-10', entry, activeTags, userId: 'user1' });

    await fireEvent.click(getByText('Save'));
    expect(getByText('Saving…')).toBeInTheDocument();

    resolveSave();
    await waitFor(() => expect(getByText('✓ Saved')).toBeInTheDocument());
    await waitFor(() => expect(getByText('Edit')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('Cancel discards changes and returns to view mode', async () => {
    const { getByText, getByDisplayValue, queryByText } = await renderInEditMode({
      dateKey: '2026-06-10', entry, activeTags, userId: 'user1'
    });
    const labelInput = getByDisplayValue('Leg day');
    await fireEvent.input(labelInput, { target: { value: 'Changed label' } });
    await fireEvent.click(getByText('Cancel'));

    expect(getByText('Edit')).toBeInTheDocument();
    expect(getByText('Leg day')).toBeInTheDocument();
    expect(queryByText('Changed label')).not.toBeInTheDocument();
  });

  it('includes completed task ids in saveDay call', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { getByLabelText, getByText } = await renderInEditMode({ dateKey: '2026-06-10', entry, activeTags, activeTasks, userId: 'user1' });
    await fireEvent.click(getByLabelText('Drink water'));
    await fireEvent.click(getByText('Save'));
    expect(saveDay).toHaveBeenCalledWith(
      'user1',
      '2026-06-10',
      expect.objectContaining({ tasks: expect.arrayContaining(['task1', 'task2']) })
    );
  });

  it('removing a photo (after confirm) does not call deletePhoto until Save', async () => {
    const { deletePhoto } = await import('$lib/stores/photos');
    const withPhoto: DayEntry = { ...entry, photos: ['users/user1/days/2026-06-10/existing.jpg'] };
    const { getByLabelText, findByAltText, queryByAltText } = await renderInEditMode({
      dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1'
    });

    await findByAltText('Training day snapshot');
    await fireEvent.click(getByLabelText('Remove photo'));
    await fireEvent.click(getByLabelText('Confirm remove photo'));

    expect(queryByAltText('Training day snapshot')).not.toBeInTheDocument();
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  it('deletes confirmed-removed photos and saves remaining paths on Save', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { deletePhoto } = await import('$lib/stores/photos');
    const withPhoto: DayEntry = { ...entry, photos: ['users/user1/days/2026-06-10/existing.jpg'] };
    const { getByLabelText, getByText, findByAltText } = await renderInEditMode({
      dateKey: '2026-06-10', entry: withPhoto, activeTags, userId: 'user1'
    });

    await findByAltText('Training day snapshot');
    await fireEvent.click(getByLabelText('Remove photo'));
    await fireEvent.click(getByLabelText('Confirm remove photo'));
    await fireEvent.click(getByText('Save'));

    expect(saveDay).toHaveBeenCalledWith(
      'user1',
      '2026-06-10',
      expect.objectContaining({ photos: [] })
    );
    await waitFor(() => {
      expect(deletePhoto).toHaveBeenCalledWith('users/user1/days/2026-06-10/existing.jpg');
    });
  });
});

describe('DayDetail — exercises and splits integration', () => {
  it('includes logged exercises in the saveDay call', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { getByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, exercises, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    await fireEvent.click(getByText('Splits & Exercises'));
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Log Set'));
    await fireEvent.click(getByText('Save'));

    expect(saveDay).toHaveBeenCalledWith(
      'user1',
      '2026-06-10',
      expect.objectContaining({
        exercises: [{ exerciseId: 'bench', sets: [{ weight: 20, reps: 8 }] }]
      })
    );
  });

  it('Cancel discards exercise changes made during the edit session', async () => {
    const { getByText, queryByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, exercises, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    await fireEvent.click(getByText('Splits & Exercises'));
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Cancel'));

    expect(queryByText('Bench Press')).not.toBeInTheDocument();
  });

  it('includes selected splitIds in the saveDay call', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { getByText } = render(DayDetail, {
      props: { dateKey: '2026-06-10', entry, activeTags, splits, userId: 'user1' }
    });
    await fireEvent.click(getByText('Edit'));
    await fireEvent.click(getByText('Splits & Exercises'));
    await fireEvent.click(getByText('Push Day'));
    await fireEvent.click(getByText('Save'));

    expect(saveDay).toHaveBeenCalledWith(
      'user1',
      '2026-06-10',
      expect.objectContaining({ splitIds: ['push'] })
    );
  });
});
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including `DayDetail.test.ts` (14 tests), the five new component test files from Tasks 1-5, and every other pre-existing test file (`DayModal.test.ts` must still pass unmodified — it only ever renders `<DayDetail>` as a black box).

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manually verify in the browser**

Run: `npm run dev`, open a day (via Calendar or Home) that already has tags/splits/exercises/notes/photos logged, and check:
- View mode renders identically to before (tags, splits, label, exercises, daily tasks, notes, photos, Edit button).
- Clicking Edit opens the same edit form; toggling tags, expanding Splits & Exercises, editing the label, checking daily tasks, editing the note, and uploading/removing a photo all behave exactly as before.
- On mobile width, editing the note still hides the other sections.
- Save and Cancel both work as before.
- Open the same day via the Home page's inline view (not the modal) and confirm it still renders correctly there too (Home page doesn't wrap `DayDetail` in a modal, so it exercises a different layout context).

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/DayDetail.svelte src/lib/components/DayDetail.test.ts
git commit -m "refactor: rewire DayDetail as a thin orchestrator over the extracted field components"
```
