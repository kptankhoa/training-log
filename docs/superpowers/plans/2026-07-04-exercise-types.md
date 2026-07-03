# Exercise Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an exercise be marked as `weight`, `bodyweight`, or `time`, changing what a logged set records for it, with optional equipment and single-arm tags for weight exercises.

**Architecture:** `ExerciseSet` becomes a discriminated union keyed by `type`. An exercise's *current* type (read from the catalog, never from an already-logged set) decides what the logging UI shows and what a new set writes; a set's own `type` is fixed forever once logged, so changing an exercise's type never reinterprets history. Legacy sets/exercises with no `type` field at all resolve to `'weight'` at read time — no Firestore migration.

**Tech Stack:** SvelteKit 2, Svelte 5 legacy syntax, TypeScript, Firestore, Vitest + @testing-library/svelte.

## Global Constraints

- No Firestore document migration. Every legacy set/exercise (no `type` field) resolves to `'weight'` at read time via `resolveSetType()` / `exercise.type ?? 'weight'`.
- `ExerciseSet.type` is optional only on the `weight` variant (`{ type?: 'weight'; weight; reps }`), not required across all three union members — this keeps every pre-existing `{ weight, reps }` literal in the codebase (tests included) a valid `ExerciseSet` with no cast and no edits required.
- Equipment is exactly: `'barbell' | 'dumbbell' | 'cable' | 'machine'` — no other values, no free text.
- A set's `type` never changes after logging. Changing an exercise's type in Settings only affects sets logged after the change. Fixing a wrong historical set means deleting it and re-logging — no in-place set editing is being added.
- Switching an exercise away from `weight` and back does not clear a previously-set `equipment` or `singleArm` — they're just unused while the type is something else.
- New store update functions follow the existing one-field-per-function pattern (see `updateExerciseSplits` in `src/lib/stores/exercises.ts`) — a single `updateDoc` call each.
- New async calls triggered from UI event handlers are wrapped in try/catch, calling `showError()` from `$lib/stores/toast` on failure — the app-wide convention (see `toggleExerciseSplit` in `src/routes/settings/+page.svelte`).
- Compact set display has no unit suffix for weight (`"60×8"`, matching existing behavior exactly), `"×8"` for bodyweight, `"45s"` for time.
- Steppers: weight ±2.5 (floor 0, unchanged), reps ±1 (floor 1, unchanged), duration ±5 seconds (floor 0, new).
- `src/routes/settings/+page.svelte` has no existing test file (a pre-existing gap) — Task 3 does not add one; verify it via `npm run check` and manual interaction instead of a test suite.

---

### Task 1: Data model — `ExerciseType`, `Equipment`, discriminated `ExerciseSet`

**Files:**
- Modify: `src/lib/types.ts`
- Test: `src/lib/types.test.ts` (new file)

**Interfaces:**
- Produces: `ExerciseType = 'weight' | 'bodyweight' | 'time'`, `Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine'`, `Exercise.type?: ExerciseType`, `Exercise.equipment?: Equipment`, `Exercise.singleArm?: boolean`, `ExerciseSet` as a discriminated union, `resolveSetType(set: ExerciseSet): ExerciseType`, `formatSet(set: ExerciseSet): string`. Every later task imports these from `$lib/types`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveSetType, formatSet, type ExerciseSet } from './types';

describe('resolveSetType', () => {
  it('returns the type field when present', () => {
    expect(resolveSetType({ type: 'bodyweight', reps: 12 })).toBe('bodyweight');
    expect(resolveSetType({ type: 'time', seconds: 45 })).toBe('time');
    expect(resolveSetType({ type: 'weight', weight: 60, reps: 8 })).toBe('weight');
  });

  it('falls back to "weight" for a legacy set with no type field', () => {
    // No cast needed — `type` is optional on the weight variant specifically,
    // so a bare { weight, reps } is already a valid ExerciseSet.
    const legacySet: ExerciseSet = { weight: 60, reps: 8 };
    expect(resolveSetType(legacySet)).toBe('weight');
  });
});

describe('formatSet', () => {
  it('formats a weight set as "weight×reps" with no unit', () => {
    expect(formatSet({ type: 'weight', weight: 60, reps: 8 })).toBe('60×8');
  });

  it('formats a legacy set with no type field the same as a weight set', () => {
    const legacySet: ExerciseSet = { weight: 60, reps: 8 };
    expect(formatSet(legacySet)).toBe('60×8');
  });

  it('formats a bodyweight set as "×reps"', () => {
    expect(formatSet({ type: 'bodyweight', reps: 12 })).toBe('×12');
  });

  it('formats a time set as "seconds followed by s"', () => {
    expect(formatSet({ type: 'time', seconds: 45 })).toBe('45s');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/types.test.ts`
Expected: FAIL — `resolveSetType`/`formatSet` are not exported from `./types` (module has no such exports yet).

- [ ] **Step 3: Update `src/lib/types.ts`**

Replace the existing `Exercise` and `ExerciseSet` declarations with:

```ts
export type ExerciseType = 'weight' | 'bodyweight' | 'time';
export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine';

export interface Exercise {
  id: string;
  name: string;
  deleted: boolean;
  splitIds?: string[]; // splits this exercise belongs to; empty/undefined = available for any split
  type?: ExerciseType; // undefined = 'weight' (every exercise created before this field existed)
  equipment?: Equipment; // only meaningful when type is 'weight'; optional even then
  singleArm?: boolean; // only meaningful when type is 'weight'; purely descriptive
}

export type ExerciseSet =
  | { type?: 'weight'; weight: number; reps: number }
  | { type: 'bodyweight'; reps: number }
  | { type: 'time'; seconds: number };

// Every set logged before this feature shipped is a bare `{ weight, reps }`
// with no `type` field at all. Rather than migrating stored documents or
// force-casting legacy literals, `type` is optional specifically on the
// weight variant — `{ weight: 60, reps: 8 }` is a genuinely valid
// ExerciseSet with no cast needed, so every existing test file's set
// literals across the codebase keep type-checking completely unmodified.
// Every newly logged set still always writes a real `type` explicitly; the
// optional case only ever matters for reading pre-existing history.
export function resolveSetType(set: ExerciseSet): ExerciseType {
  return set.type ?? 'weight';
}

// Compact display format for a logged set, shared by the set-logging chips
// (ExerciseEditor.svelte) and the read-only day summary (DaySplitsExercises.svelte)
// so the two formats can't drift apart. Narrows on `set.type` directly
// (rather than switching on resolveSetType's return value) so each branch
// gets real property access with no casts.
export function formatSet(set: ExerciseSet): string {
  if (set.type === 'bodyweight') return `×${set.reps}`;
  if (set.type === 'time') return `${set.seconds}s`;
  return `${set.weight}×${set.reps}`; // 'weight', or legacy data with no type field at all
}
```

The rest of `src/lib/types.ts` (`GruvboxColor`, `TrainingTag`, `DayEntry`, `ExerciseEntry`, `DailyTask`, `Split`, `BodyMeasurement`, `BodyMeasurementEntry`) is unchanged — only insert the block above in place of the old `Exercise`/`ExerciseSet` definitions, keeping it in the same position in the file (`ExerciseEntry` still comes right after, unchanged, since it references `ExerciseSet`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/types.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full check and test suite**

Run: `npm run check && npx vitest run`
Expected: 0 type errors and every existing test still passes, plus the 6 new `types.test.ts` passes — `type` being optional only on the weight variant means every pre-existing `{ weight, reps }` set literal anywhere in the codebase (tests included) remains a valid `ExerciseSet` with no changes needed. If `npm run check` reports any error at this step, it means something unexpected is constructing an `ExerciseSet`-typed value that matches none of the three variants — investigate before continuing; do not proceed to Task 2 with a non-clean `npm run check`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/types.test.ts
git commit -m "feat: add exercise types (weight/bodyweight/time) to the data model"
```

---

### Task 2: Store functions — `updateExerciseType`, `updateExerciseEquipment`, `updateExerciseSingleArm`

**Files:**
- Modify: `src/lib/stores/exercises.ts`
- Test: `src/lib/stores/exercises.test.ts`

**Interfaces:**
- Consumes: `ExerciseType`, `Equipment` from `$lib/types` (Task 1).
- Produces: `updateExerciseType(userId: string, exerciseId: string, type: ExerciseType): Promise<void>`, `updateExerciseEquipment(userId: string, exerciseId: string, equipment: Equipment | null): Promise<void>`, `updateExerciseSingleArm(userId: string, exerciseId: string, singleArm: boolean): Promise<void>`. Task 3 imports and calls all three.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/stores/exercises.test.ts`, inside the existing `describe('exercises store', ...)` block, right after the `updateExerciseSplits` test (before the closing `});` of that describe block):

```ts
  it('updateExerciseType calls updateDoc with the new type', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateExerciseType } = await import('./exercises');
    await updateExerciseType('user1', 'ex1', 'bodyweight');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { type: 'bodyweight' });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'exercises', 'ex1');
  });

  it('updateExerciseEquipment calls updateDoc with the new equipment', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateExerciseEquipment } = await import('./exercises');
    await updateExerciseEquipment('user1', 'ex1', 'dumbbell');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { equipment: 'dumbbell' });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'exercises', 'ex1');
  });

  it('updateExerciseEquipment clears equipment when passed null', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateExerciseEquipment } = await import('./exercises');
    await updateExerciseEquipment('user1', 'ex1', null);
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { equipment: null });
  });

  it('updateExerciseSingleArm calls updateDoc with the new flag', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateExerciseSingleArm } = await import('./exercises');
    await updateExerciseSingleArm('user1', 'ex1', true);
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { singleArm: true });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'exercises', 'ex1');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/stores/exercises.test.ts`
Expected: FAIL — `updateExerciseType`, `updateExerciseEquipment`, `updateExerciseSingleArm` are not exported from `./exercises`.

- [ ] **Step 3: Add the three functions to `src/lib/stores/exercises.ts`**

Change the import line:

```ts
import type { Exercise, ExerciseType, Equipment } from '$lib/types';
```

Add at the end of the file, after `updateExerciseSplits`:

```ts
export async function updateExerciseType(userId: string, exerciseId: string, type: ExerciseType): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'exercises', exerciseId), { type });
}

export async function updateExerciseEquipment(userId: string, exerciseId: string, equipment: Equipment | null): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'exercises', exerciseId), { equipment });
}

export async function updateExerciseSingleArm(userId: string, exerciseId: string, singleArm: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'exercises', exerciseId), { singleArm });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/stores/exercises.test.ts`
Expected: PASS (10 tests — 6 existing + 4 new)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/exercises.ts src/lib/stores/exercises.test.ts
git commit -m "feat: add store functions for exercise type, equipment, and single-arm"
```

---

### Task 3: Settings → Exercises editor — Type, Equipment, Single-arm controls

**Files:**
- Modify: `src/routes/settings/+page.svelte`

**Interfaces:**
- Consumes: `updateExerciseType`, `updateExerciseEquipment`, `updateExerciseSingleArm` from `$lib/stores/exercises` (Task 2); `ExerciseType`, `Equipment` from `$lib/types` (Task 1); `showError` from `$lib/stores/toast` (already imported in this file).
- Produces: nothing consumed by later tasks — this is a leaf UI task.

This file has no existing test file (a pre-existing gap, not introduced by this feature) — this task is verified via `npm run check` and manual interaction in the dev server, not a test suite.

- [ ] **Step 1: Add imports**

In `src/routes/settings/+page.svelte`, change:

```ts
import { activeExercises, exercisesLoading, addExercise, deleteExercise, updateExerciseSplits } from '$lib/stores/exercises';
```

to:

```ts
import {
  activeExercises,
  exercisesLoading,
  addExercise,
  deleteExercise,
  updateExerciseSplits,
  updateExerciseType,
  updateExerciseEquipment,
  updateExerciseSingleArm,
} from '$lib/stores/exercises';
```

Change:

```ts
import type { Exercise, GruvboxColor } from '$lib/types';
```

to:

```ts
import type { Exercise, GruvboxColor, ExerciseType, Equipment } from '$lib/types';
```

- [ ] **Step 2: Add option lists and handler functions**

Add near the top of the `<script>` block, after the existing `let expandedExerciseId: string | null = null;` line:

```ts
const EXERCISE_TYPES: { value: ExerciseType; label: string }[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'time', label: 'Time' },
];

const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'cable', label: 'Cable' },
  { value: 'machine', label: 'Machine' },
];

function handleSetExerciseType(exercise: Exercise, type: ExerciseType) {
  updateExerciseType(userId, exercise.id, type).catch(() => showError());
}

function handleSetExerciseEquipment(exercise: Exercise, equipment: Equipment) {
  const next = exercise.equipment === equipment ? null : equipment;
  updateExerciseEquipment(userId, exercise.id, next).catch(() => showError());
}

function handleToggleSingleArm(exercise: Exercise) {
  updateExerciseSingleArm(userId, exercise.id, !exercise.singleArm).catch(() => showError());
}
```

- [ ] **Step 3: Add the Type/Equipment/Single-arm controls to the expanded exercise row**

Find this block in the template (inside the `{#if expandedExerciseId === exercise.id}` section):

```svelte
                {#if expandedExerciseId === exercise.id}
                  <div class="px-4 pb-3 flex flex-col gap-2">
                    <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Tied to splits (none = always available)</span>
```

Replace it with:

```svelte
                {#if expandedExerciseId === exercise.id}
                  <div class="px-4 pb-3 flex flex-col gap-2">
                    <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Type</span>
                    <div class="flex flex-wrap gap-2">
                      {#each EXERCISE_TYPES as opt}
                        <button
                          type="button"
                          on:click={() => handleSetExerciseType(exercise, opt.value)}
                          class="px-3 py-1 text-xs border transition
                                 {(exercise.type ?? 'weight') === opt.value
                                   ? 'border-gb-light-green dark:border-gb-green text-gb-light-green dark:text-gb-green bg-gb-light-bg2 dark:bg-gb-bg2'
                                   : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue'}"
                        >{opt.label}</button>
                      {/each}
                    </div>

                    {#if (exercise.type ?? 'weight') === 'weight'}
                      <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Equipment</span>
                      <div class="flex flex-wrap gap-2">
                        {#each EQUIPMENT_OPTIONS as opt}
                          <button
                            type="button"
                            on:click={() => handleSetExerciseEquipment(exercise, opt.value)}
                            class="px-3 py-1 text-xs border transition
                                   {exercise.equipment === opt.value
                                     ? 'border-gb-light-green dark:border-gb-green text-gb-light-green dark:text-gb-green bg-gb-light-bg2 dark:bg-gb-bg2'
                                     : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue'}"
                          >{opt.label}</button>
                        {/each}
                      </div>

                      <label class="flex items-center gap-2 text-xs text-gb-light-fg3 dark:text-gb-fg3">
                        <input
                          type="checkbox"
                          checked={exercise.singleArm ?? false}
                          on:change={() => handleToggleSingleArm(exercise)}
                          class="accent-gb-light-green dark:accent-gb-green"
                        />
                        Single-arm
                      </label>
                    {/if}

                    <span class="text-xs text-gb-light-fg3 dark:text-gb-fg3 uppercase tracking-wider">Tied to splits (none = always available)</span>
```

Everything after that line (the `{#if $splits.length === 0}` block and the closing `{/if}`/`{/if}`/`</div>` for this section) stays exactly as it is today — only the content *before* the existing "Tied to splits" line is new.

- [ ] **Step 4: Run the type checker**

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Manually verify in the dev server**

Run: `npm run dev`

Sign in, go to Settings → Exercises, expand any exercise, and confirm:
- Type defaults to "Weight" selected.
- Clicking "Bodyweight" or "Time" hides the Equipment row and Single-arm checkbox.
- Clicking back to "Weight" shows them again, and any previously-picked equipment/single-arm state is still there (not cleared by switching away and back).
- Clicking an equipment button selects it (green border); clicking the same one again deselects it.
- Toggling the Single-arm checkbox persists across a page reload.

- [ ] **Step 6: Commit**

```bash
git add src/routes/settings/+page.svelte
git commit -m "feat: add exercise type, equipment, and single-arm controls to Settings"
```

---

### Task 4: Set logging — type-aware steppers in `ExerciseEditor.svelte`

**Files:**
- Modify: `src/lib/components/day-detail/ExerciseEditor.svelte`
- Test: `src/lib/components/day-detail/ExerciseEditor.test.ts`

**Interfaces:**
- Consumes: `ExerciseSet`, `formatSet` from `$lib/types` (Task 1). Reads `exercise.type`/`exercise.equipment`/`exercise.singleArm` from the `exercises` prop (Task 1's `Exercise` shape) — never from an already-logged set.
- Produces: nothing consumed by later tasks — this is a leaf UI task.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/components/day-detail/ExerciseEditor.test.ts`, as a new `describe` block at the end of the file (after the closing `});` of `describe('ExerciseEditor — filtering by the day\'s selected splits', ...)`):

```ts
describe('ExerciseEditor — exercise types', () => {
  const bodyweightExercise: Exercise[] = [
    { id: 'pushup', name: 'Push-up', deleted: false, type: 'bodyweight' },
  ];
  const timeExercise: Exercise[] = [
    { id: 'plank', name: 'Plank', deleted: false, type: 'time' },
  ];
  const weightWithEquipment: Exercise[] = [
    { id: 'row', name: 'Dumbbell Row', deleted: false, type: 'weight', equipment: 'dumbbell', singleArm: true },
  ];

  it('a bodyweight exercise shows only a reps stepper, no weight stepper', async () => {
    const { getByText, getByLabelText, queryByLabelText } = render(ExerciseEditor, {
      props: { exercises: bodyweightExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Push-up'));
    expect(getByLabelText('Increase reps')).toBeInTheDocument();
    expect(queryByLabelText('Increase weight')).not.toBeInTheDocument();
  });

  it('logging a bodyweight set records reps only, formatted as ×N', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: bodyweightExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Push-up'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('×8 ✕')).toBeInTheDocument();
  });

  it('a time exercise shows only a duration stepper, no weight or reps stepper', async () => {
    const { getByText, getByLabelText, queryByLabelText } = render(ExerciseEditor, {
      props: { exercises: timeExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Plank'));
    expect(getByLabelText('Increase duration')).toBeInTheDocument();
    expect(queryByLabelText('Increase weight')).not.toBeInTheDocument();
    expect(queryByLabelText('Increase reps')).not.toBeInTheDocument();
  });

  it('logging a time set records seconds, formatted as Ns', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: timeExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Plank'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('30s ✕')).toBeInTheDocument();
  });

  it('the duration stepper steps by 5 seconds', async () => {
    const { getByText, getByLabelText } = render(ExerciseEditor, {
      props: { exercises: timeExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Plank'));
    await fireEvent.click(getByLabelText('Increase duration'));
    expect(getByText('35s')).toBeInTheDocument();
  });

  it('pre-fills the duration draft from the last logged time set', async () => {
    const allDays: Record<string, DayEntry> = {
      '2026-06-05': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'plank', sets: [{ type: 'time', seconds: 60 }] }] },
    };
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: timeExercise, allDays, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Plank'));
    expect(getByText('60s')).toBeInTheDocument();
  });

  it('shows equipment and single-arm as a suffix on the logged exercise name', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: weightWithEquipment, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Dumbbell Row'));
    expect(getByText('Dumbbell Row · Dumbbell · single-arm')).toBeInTheDocument();
  });

  it('does not add an equipment/single-arm suffix for a plain weight exercise', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    expect(getByText('Bench Press')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/components/day-detail/ExerciseEditor.test.ts`
Expected: FAIL — all 7 new tests fail (the editor currently always renders a weight+reps stepper for every exercise, and set chips render `${weight}×${reps}` unconditionally, so a bodyweight/time exercise still shows a weight stepper and its logged set doesn't format as `×8`/`30s`).

- [ ] **Step 3: Rewrite `src/lib/components/day-detail/ExerciseEditor.svelte`**

Replace the entire file with:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { holdRepeat } from '$lib/actions/holdRepeat';
  import { addExercise } from '$lib/stores/exercises';
  import { getLastLoggedSet, getLastSessionExercises } from '$lib/exerciseHistory';
  import { showError } from '$lib/stores/toast';
  import { formatSet } from '$lib/types';
  import type { Exercise, ExerciseEntry, ExerciseSet, ExerciseType, DayEntry } from '$lib/types';

  export let exercises: Exercise[] = []; // full catalog, incl. deleted, for name resolution
  export let allDays: Record<string, DayEntry> = {};
  export let dateKey: string;
  export let userId: string;
  export let entries: ExerciseEntry[] = [];
  // Splits selected for this day — narrows the pickable list to exercises tied
  // to one of them (plus untied exercises, which are always available). No
  // splits selected means no filtering at all.
  export let daySplitIds: string[] = [];

  $: activeExerciseCatalog = exercises.filter((e) => !e.deleted);
  $: exerciseById: Record<string, Exercise> = Object.fromEntries(exercises.map((e) => [e.id, e]));
  $: pickableExercises = activeExerciseCatalog.filter((ex) => {
    if (entries.some((e) => e.exerciseId === ex.id)) return false;
    if (daySplitIds.length === 0) return true;
    const tiedSplits = ex.splitIds ?? [];
    return tiedSplits.length === 0 || tiedSplits.some((sid) => daySplitIds.includes(sid));
  });
  $: lastSessionExercises = getLastSessionExercises(allDays, dateKey);

  let draftWeight: Record<string, number> = {};
  let draftReps: Record<string, number> = {};
  let draftSeconds: Record<string, number> = {};
  let addingExercise = false;
  let newExerciseName = '';

  // "Click again to confirm" delete pattern — arms for 3s, then auto-reverts.
  let confirmingExerciseId: string | null = null;
  let confirmExerciseTimeout: ReturnType<typeof setTimeout> | null = null;

  // The exercise catalog's own type decides what a set for it looks like —
  // never the type of any set already logged — so changing an exercise's
  // type in Settings only ever affects sets logged from that point on.
  function typeOf(exerciseId: string): ExerciseType {
    return exerciseById[exerciseId]?.type ?? 'weight';
  }

  function exerciseLabel(exerciseId: string): string {
    const exercise = exerciseById[exerciseId];
    if (!exercise) return 'Unknown exercise';
    if ((exercise.type ?? 'weight') !== 'weight') return exercise.name;
    const parts: string[] = [];
    if (exercise.equipment) parts.push(exercise.equipment.charAt(0).toUpperCase() + exercise.equipment.slice(1));
    if (exercise.singleArm) parts.push('single-arm');
    return parts.length > 0 ? `${exercise.name} · ${parts.join(' · ')}` : exercise.name;
  }

  function initDraftFor(exerciseId: string) {
    if (draftWeight[exerciseId] !== undefined) return;
    const last = getLastLoggedSet(allDays, exerciseId, dateKey);
    const lastWeight = last && 'weight' in last ? last.weight : undefined;
    const lastReps = last && 'reps' in last ? last.reps : undefined;
    const lastSeconds = last && 'seconds' in last ? last.seconds : undefined;
    draftWeight = { ...draftWeight, [exerciseId]: lastWeight ?? 20 };
    draftReps = { ...draftReps, [exerciseId]: lastReps ?? 8 };
    draftSeconds = { ...draftSeconds, [exerciseId]: lastSeconds ?? 30 };
  }

  onMount(() => {
    entries.forEach((e) => initDraftFor(e.exerciseId));
  });

  onDestroy(() => {
    if (confirmExerciseTimeout) clearTimeout(confirmExerciseTimeout);
  });

  function addExerciseToLog(exerciseId: string) {
    if (entries.some((e) => e.exerciseId === exerciseId)) return;
    entries = [...entries, { exerciseId, sets: [] }];
    initDraftFor(exerciseId);
  }

  function adjustWeight(exerciseId: string, delta: number) {
    const next = Math.max(0, (draftWeight[exerciseId] ?? 0) + delta);
    draftWeight = { ...draftWeight, [exerciseId]: next };
  }

  function adjustReps(exerciseId: string, delta: number) {
    const next = Math.max(1, (draftReps[exerciseId] ?? 1) + delta);
    draftReps = { ...draftReps, [exerciseId]: next };
  }

  function adjustSeconds(exerciseId: string, delta: number) {
    const next = Math.max(0, (draftSeconds[exerciseId] ?? 0) + delta);
    draftSeconds = { ...draftSeconds, [exerciseId]: next };
  }

  function logSet(exerciseId: string) {
    const type = typeOf(exerciseId);
    let set: ExerciseSet;
    if (type === 'bodyweight') {
      set = { type: 'bodyweight', reps: draftReps[exerciseId] ?? 0 };
    } else if (type === 'time') {
      set = { type: 'time', seconds: draftSeconds[exerciseId] ?? 0 };
    } else {
      set = { type: 'weight', weight: draftWeight[exerciseId] ?? 0, reps: draftReps[exerciseId] ?? 0 };
    }
    entries = entries.map((e) =>
      e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, set] } : e
    );
  }

  function removeSet(exerciseId: string, setIndex: number) {
    entries = entries.map((e) =>
      e.exerciseId === exerciseId ? { ...e, sets: e.sets.filter((_, i) => i !== setIndex) } : e
    );
  }

  function handleRemoveExerciseClick(exerciseId: string) {
    if (confirmingExerciseId === exerciseId) {
      if (confirmExerciseTimeout) clearTimeout(confirmExerciseTimeout);
      confirmingExerciseId = null;
      entries = entries.filter((e) => e.exerciseId !== exerciseId);
      return;
    }
    confirmingExerciseId = exerciseId;
    if (confirmExerciseTimeout) clearTimeout(confirmExerciseTimeout);
    confirmExerciseTimeout = setTimeout(() => { confirmingExerciseId = null; }, 3000);
  }

  function copyLastSession() {
    if (!lastSessionExercises) return;
    entries = lastSessionExercises.map((e) => ({ exerciseId: e.exerciseId, sets: [] }));
    entries.forEach((e) => initDraftFor(e.exerciseId));
  }

  async function commitNewExercise() {
    const name = newExerciseName.trim();
    if (!name) { addingExercise = false; return; }
    newExerciseName = '';
    addingExercise = false;
    try {
      const id = await addExercise(userId, name);
      addExerciseToLog(id);
    } catch {
      showError();
    }
  }

  function autofocus(el: HTMLInputElement) {
    el.focus();
  }
</script>

{#if entries.length === 0 && lastSessionExercises}
  <button
    type="button"
    on:click={copyLastSession}
    class="self-start text-sm text-gb-light-blue dark:text-gb-blue hover:text-gb-light-fg dark:hover:text-gb-fg transition"
  >Copy last session</button>
{/if}

{#if entries.length > 0}
  <div class="max-h-72 overflow-y-auto flex flex-col gap-2 pr-1">
    {#each entries as ex (ex.exerciseId)}
      {@const exType = typeOf(ex.exerciseId)}
      <div class="bg-gb-light-bg2 dark:bg-gb-bg2 border border-gb-light-bg3 dark:border-gb-bg3 p-3 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-semibold text-gb-light-fg dark:text-gb-fg">{exerciseLabel(ex.exerciseId)}</span>
          <button
            type="button"
            on:click={() => handleRemoveExerciseClick(ex.exerciseId)}
            aria-label={confirmingExerciseId === ex.exerciseId ? 'Confirm remove exercise' : 'Remove exercise'}
            class="text-xs font-medium px-2 py-1 transition-colors shrink-0
                   {confirmingExerciseId === ex.exerciseId ? 'text-white bg-gb-light-red dark:bg-gb-red' : 'text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-red dark:hover:text-gb-red'}"
          >{confirmingExerciseId === ex.exerciseId ? 'Confirm?' : '✕'}</button>
        </div>

        {#if ex.sets.length > 0}
          <div class="flex flex-wrap gap-1.5">
            {#each ex.sets as set, i}
              <button
                type="button"
                on:click={() => removeSet(ex.exerciseId, i)}
                class="text-xs px-2 py-1 bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-red dark:hover:border-gb-red hover:text-gb-light-red dark:hover:text-gb-red transition"
              >{formatSet(set)} ✕</button>
            {/each}
          </div>
        {/if}

        <div class="flex items-center gap-2">
          {#if exType === 'weight'}
            <div class="flex items-center gap-1">
              <button
                type="button"
                use:holdRepeat={() => adjustWeight(ex.exerciseId, -2.5)}
                aria-label="Decrease weight"
                class="w-7 h-7 flex items-center justify-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-blue dark:hover:border-gb-blue transition select-none"
              >-</button>
              <span class="text-sm text-gb-light-fg dark:text-gb-fg w-14 text-center tabular-nums">{draftWeight[ex.exerciseId] ?? 0}kg</span>
              <button
                type="button"
                use:holdRepeat={() => adjustWeight(ex.exerciseId, 2.5)}
                aria-label="Increase weight"
                class="w-7 h-7 flex items-center justify-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-blue dark:hover:border-gb-blue transition select-none"
              >+</button>
            </div>
          {/if}
          {#if exType === 'weight' || exType === 'bodyweight'}
            <div class="flex items-center gap-1">
              <button
                type="button"
                use:holdRepeat={() => adjustReps(ex.exerciseId, -1)}
                aria-label="Decrease reps"
                class="w-7 h-7 flex items-center justify-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-blue dark:hover:border-gb-blue transition select-none"
              >-</button>
              <span class="text-sm text-gb-light-fg dark:text-gb-fg w-8 text-center tabular-nums">{draftReps[ex.exerciseId] ?? 0}</span>
              <button
                type="button"
                use:holdRepeat={() => adjustReps(ex.exerciseId, 1)}
                aria-label="Increase reps"
                class="w-7 h-7 flex items-center justify-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-blue dark:hover:border-gb-blue transition select-none"
              >+</button>
            </div>
          {/if}
          {#if exType === 'time'}
            <div class="flex items-center gap-1">
              <button
                type="button"
                use:holdRepeat={() => adjustSeconds(ex.exerciseId, -5)}
                aria-label="Decrease duration"
                class="w-7 h-7 flex items-center justify-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-blue dark:hover:border-gb-blue transition select-none"
              >-</button>
              <span class="text-sm text-gb-light-fg dark:text-gb-fg w-14 text-center tabular-nums">{draftSeconds[ex.exerciseId] ?? 0}s</span>
              <button
                type="button"
                use:holdRepeat={() => adjustSeconds(ex.exerciseId, 5)}
                aria-label="Increase duration"
                class="w-7 h-7 flex items-center justify-center bg-gb-light-bg1 dark:bg-gb-bg1 border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg dark:text-gb-fg hover:border-gb-light-blue dark:hover:border-gb-blue transition select-none"
              >+</button>
            </div>
          {/if}
          <button
            type="button"
            on:click={() => logSet(ex.exerciseId)}
            class="flex-1 bg-gb-light-green dark:bg-gb-green text-gb-light-bg dark:text-gb-bg font-semibold text-sm px-3 py-1.5 hover:opacity-90 transition"
          >Log Set</button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<div class="flex flex-wrap gap-2">
  {#each pickableExercises as ex (ex.id)}
    <button
      type="button"
      on:click={() => addExerciseToLog(ex.id)}
      class="px-3 py-1 rounded-full border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 text-sm
             hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue transition"
    >+ {ex.name}</button>
  {/each}

  {#if addingExercise}
    <input
      type="text"
      bind:value={newExerciseName}
      placeholder="Type name…"
      on:keydown={(e) => e.key === 'Enter' && commitNewExercise()}
      on:blur={commitNewExercise}
      class="px-3 py-1 rounded-full border border-gb-light-bg3 dark:border-gb-bg3 bg-gb-light-bg2 dark:bg-gb-bg2 text-gb-light-fg dark:text-gb-fg
             text-sm focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
      use:autofocus
    />
  {:else}
    <button
      type="button"
      on:click={() => (addingExercise = true)}
      class="px-3 py-1 rounded-full border border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 text-sm
             hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue transition"
    >+ Add exercise</button>
  {/if}
</div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/components/day-detail/ExerciseEditor.test.ts`
Expected: PASS (all tests — the 16 pre-existing ones plus the 7 new ones from Step 1)

- [ ] **Step 5: Run the type checker**

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/day-detail/ExerciseEditor.svelte src/lib/components/day-detail/ExerciseEditor.test.ts
git commit -m "feat: type-aware set logging for weight, bodyweight, and time exercises"
```

---

### Task 5: Read-only display — `DaySplitsExercises.svelte` summary formatting

**Files:**
- Modify: `src/lib/components/day-detail/DaySplitsExercises.svelte`
- Test: `src/lib/components/day-detail/DaySplitsExercises.test.ts`

**Interfaces:**
- Consumes: `formatSet` from `$lib/types` (Task 1).
- Produces: nothing consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/components/day-detail/DaySplitsExercises.test.ts`, inside `describe('DaySplitsExercises — readonly mode', ...)`, right after the existing `'shows logged exercises with sets'` test:

```ts
  it('shows bodyweight and time sets in the readonly summary with their own formats', () => {
    const mixedExercises: Exercise[] = [
      { id: 'pushup', name: 'Push-up', deleted: false, type: 'bodyweight' },
      { id: 'plank', name: 'Plank', deleted: false, type: 'time' },
    ];
    const { getByText } = render(DaySplitsExercises, {
      props: {
        splits, exercises: mixedExercises, selectedSplitIds: new Set<string>(),
        exerciseEntries: [
          { exerciseId: 'pushup', sets: [{ type: 'bodyweight', reps: 20 }] },
          { exerciseId: 'plank', sets: [{ type: 'time', seconds: 45 }] },
        ],
        readonly: true
      }
    });
    expect(getByText(/×20/)).toBeInTheDocument();
    expect(getByText(/45s/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/day-detail/DaySplitsExercises.test.ts`
Expected: FAIL — the current summary line reads `${s.weight}×${s.reps}`, so a bodyweight set (`{ type: 'bodyweight', reps: 20 }`, no `weight` field) renders as `"undefined×20"`, not `"×20"`.

- [ ] **Step 3: Update `src/lib/components/day-detail/DaySplitsExercises.svelte`**

Change the import line from:

```ts
  import type { Exercise, ExerciseEntry, Split, DayEntry } from '$lib/types';
```

to:

```ts
  import { formatSet } from '$lib/types';
  import type { Exercise, ExerciseEntry, Split, DayEntry } from '$lib/types';
```

Change:

```svelte
              <span class="text-gb-light-fg3 dark:text-gb-fg3"> — {ex.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')}</span>
```

to:

```svelte
              <span class="text-gb-light-fg3 dark:text-gb-fg3"> — {ex.sets.map(formatSet).join(', ')}</span>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/day-detail/DaySplitsExercises.test.ts`
Expected: PASS (all tests — the 12 pre-existing ones plus the 1 new one from Step 1)

- [ ] **Step 5: Run the full check and test suite**

Run: `npm run check && npx vitest run`
Expected: 0 type errors; every test file passes.

- [ ] **Step 6: Run the production build**

Run: `npm run build`
Expected: builds successfully with no new warnings beyond the pre-existing, already-investigated Firebase chunk-size warning.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/day-detail/DaySplitsExercises.svelte src/lib/components/day-detail/DaySplitsExercises.test.ts
git commit -m "feat: format bodyweight and time sets in the read-only day summary"
```
