# DayDetail Breakdown — Design Spec
_2026-07-02_

## Overview

`src/lib/components/DayDetail.svelte` is 528 lines and bundles five unrelated concerns (tags, splits+exercises, label, daily tasks, notes, photos) plus view/edit mode switching and save/cancel orchestration, all as one flat file with one flat state object. This spec splits it into five new self-contained components plus a much smaller orchestrator, with **no change to `DayDetail`'s external prop/event interface** — `DayModal.svelte`, `src/routes/+page.svelte`, and `src/routes/calendar/+page.svelte` all render `<DayDetail>` today and need zero changes after this refactor.

---

## Architecture

Six files replace the current one:

- **`DayPhotos.svelte`** (new) — owns every photo concern: resolving download URLs, upload, confirm-to-remove, and the lightbox. Internal state (`photoUrls`, `uploadingPhoto`, `photoError`, `fileInput`, `confirmingPhotoPath`, `confirmPhotoTimeout`, `lightboxUrl`) never leaves this component.
- **`DayTagsField.svelte`** (new) — owns the tag picker, including the inline "+ Add" flow (calls `addTag` itself). Internal state: `newTagName`, `addingTag`.
- **`DaySplitsExercises.svelte`** (new) — owns the split picker + `ExerciseEditor`, including the accordion's own expand/collapse state (`splitsExpanded`).
- **`DayDetailView.svelte`** (new) — pure read-only display, composing the two components above in `readonly` mode plus small inline blocks for Label/Daily tasks/Notes. Dispatches `edit`.
- **`DayDetailEditForm.svelte`** (new) — composes the same two components in edit mode, plus `FormField` (Label), an inline daily-tasks checklist, `MarkdownEditor`, and `DayPhotos` in edit mode. Dispatches `save`/`cancel`.
- **`DayDetail.svelte`** (rewritten, ~90 lines) — owns `mode` and all draft state (the values that get committed on Save or discarded on Cancel: `selectedIds`, `selectedSplitIds`, `completedTaskIds`, `label`, `note`, `noteMode`, `exerciseEntries`, `photoPaths`), plus `hasAnyContent`/`startEdit`/`cancelEdit`/`handleSave`. Renders `DayDetailView` or `DayDetailEditForm` based on `mode` and reacts to their events.

A key simplification falls out of this split: because `DayDetailEditForm` (and everything inside it) only exists while `mode === 'edit'`, canceling out of edit mode unmounts it entirely. The next time the user hits Edit, a fresh `DaySplitsExercises` instance computes its own initial `splitsExpanded` from whatever `selectedSplitIds`/`exerciseEntries` were just reset to — so `DayDetail.cancelEdit()` no longer needs to manually reset `splitsExpanded`, `addingTag`, `newTagName`, `confirmingPhotoPath`, or `confirmPhotoTimeout`, because none of that state exists in `DayDetail` anymore.

Each `readonly`-mode component computes its own derived display data internally (e.g. `DayTagsField` filters `activeTags` by `selectedIds` itself) rather than receiving pre-filtered lists — so `DayDetailView` ends up doing almost no computation of its own, just prop-forwarding.

---

## Component Interfaces

### `DayPhotos.svelte`
```ts
export let photoPaths: string[];      // bindable
export let readonly: boolean = false;
export let dateKey: string = '';      // only required when !readonly
export let userId: string = '';       // only required when !readonly
```
Renders the "Progress photos" label and grid itself, including the readonly hide-when-empty guard (`{#if photoPaths.length > 0}`) — matches today's behavior where the view-mode block disappears entirely when there are no photos, while edit mode always shows the add-photo tile.

### `DayTagsField.svelte`
```ts
export let activeTags: TrainingTag[];
export let selectedIds: Set<string>;  // bindable
export let userId: string = '';       // only required when !readonly
export let readonly: boolean = false;
```

### `DaySplitsExercises.svelte`
```ts
export let splits: PlanNote[];
export let exercises: Exercise[] = [];
export let allDays: Record<string, DayEntry> = {};
export let dateKey: string = '';      // only required when !readonly
export let userId: string = '';       // only required when !readonly
export let selectedSplitIds: Set<string>;   // bindable
export let exerciseEntries: ExerciseEntry[]; // bindable
export let readonly: boolean = false;
```
In readonly mode, renders the Splits list and the Exercises list as two independently-optional blocks (exactly as today — they're each hidden individually if empty, not combined under one header). In edit mode, renders the single "Splits & Exercises" accordion.

### `DayDetailView.svelte`
```ts
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
```
Dispatches: `edit` (no payload). Notably needs no `dateKey`/`userId`/`allDays` at all — nothing in read-only mode performs a Firestore/Storage call.

### `DayDetailEditForm.svelte`
```ts
export let dateKey: string;
export let userId: string;
export let activeTags: TrainingTag[];
export let selectedIds: Set<string>;         // bindable
export let splits: PlanNote[];
export let selectedSplitIds: Set<string>;    // bindable
export let exercises: Exercise[] = [];
export let allDays: Record<string, DayEntry> = {};
export let exerciseEntries: ExerciseEntry[]; // bindable
export let label: string;                    // bindable
export let activeTasks: DailyTask[] = [];
export let completedTaskIds: Set<string>;    // bindable
export let note: string;                     // bindable
export let noteMode: 'edit' | 'preview';     // bindable
export let photoPaths: string[];             // bindable
export let hideOtherSectionsWhileEditingNote = true;
export let saving: boolean;
export let saved: boolean;
```
Dispatches: `save`, `cancel` (no payload — all state is already bound to the parent). Computes `noteEditing` internally from `hideOtherSectionsWhileEditingNote` and `noteMode`. Owns `toggleTask` locally (it only mutates the `completedTaskIds` prop it already has bound).

### `DayDetail.svelte` (external interface — unchanged from today)
```ts
export let dateKey: string;
export let entry: DayEntry;
export let activeTags: TrainingTag[];
export let activeTasks: DailyTask[] = [];
export let exercises: Exercise[] = [];
export let splits: PlanNote[] = [];
export let allDays: Record<string, DayEntry> = {};
export let userId: string;
export let hideOtherSectionsWhileEditingNote = true;
```
Dispatches: `saved` (unchanged). No `onMount`/`onDestroy` left at this level except clearing `savedResetTimeout` (photo-URL loading and its cleanup both move into `DayPhotos`).

---

## Testing

`DayDetail.test.ts` (currently 451 lines) splits along the same lines:

- Tag toggle / inline add-tag tests → `DayTagsField.test.ts`
- Split picker / exercise accordion / `ExerciseEditor` integration tests → `DaySplitsExercises.test.ts`
- Photo upload / lightbox / confirm-to-remove tests → `DayPhotos.test.ts`
- Read-only rendering assertions (nothing-logged-yet states, label/notes/tasks display) → `DayDetailView.test.ts`
- Remaining edit-form-specific assertions (e.g. daily-task checkbox toggling, the note-editing-hides-other-sections behavior) → `DayDetailEditForm.test.ts`
- `DayDetail.test.ts` shrinks to an integration suite: initial mode from `hasAnyContent`, view↔edit switching, save (including the removed-photos-get-deleted-after-save diffing, which stays in `DayDetail`), and cancel (including that canceling restores original values).

`DayModalTest.svelte` / `DayModal.test.ts` are unaffected — `DayModal` only ever treated `DayDetail` as a black box.

---

## Out of Scope

- Any behavior change. This is a pure internal restructuring; every interaction (tag toggling, split/exercise logging, photo upload/remove/lightbox, save/cancel, view/edit switching) must work identically to today.
- Changing `DayDetail`'s public prop/event interface, or anything in `DayModal.svelte`, `+page.svelte` (Home), or `calendar/+page.svelte`.
- Extracting Label or Daily-tasks into their own components — both are small enough (under 15 lines each) that a dedicated file isn't worth it; they stay inline in `DayDetailView`/`DayDetailEditForm`.
