# Equipment Per Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `equipment` off the `Exercise` catalog definition and onto each individually logged weight-type set, so the same exercise can be logged with different equipment across sessions.

**Architecture:** `ExerciseSet`'s weight variant gains an optional `equipment` field and `formatSet` renders it as a short suffix (`60×8 DB`). `ExerciseEditor.svelte` gets a per-set equipment picker (pre-filled from history, like weight/reps already are) and writes `equipment` into each logged set. The old exercise-level equipment picker and store function are deleted from Settings, and `Exercise.equipment` is removed from the type once nothing reads it.

**Tech Stack:** SvelteKit 2, Svelte 5 legacy syntax, TypeScript, Vitest + @testing-library/svelte.

## Global Constraints

- Equipment lives on each logged `ExerciseSet` (weight variant only), never on `Exercise`.
- Single-arm is unchanged — it stays a property of `Exercise`, not per-set.
- Equipment is optional on a set; logging a set with no equipment chosen is valid, same as today.
- The equipment picker pre-fills from the last logged set for that exercise, mirroring the existing weight/reps/seconds pre-fill behavior (`getLastLoggedSet`).
- Display abbreviations are exactly: `barbell` → `BB`, `dumbbell` → `DB`, `cable` → `CB`, `machine` → `MC`, appended as `` `${weight}×${reps} ${ABBR}` ``. No suffix when equipment is unset (matches today's plain `60×8`).
- No Firestore document migration. Stray `equipment` fields left on old `Exercise` documents are simply never read again.
- No new equipment options beyond the existing 4.
- No per-set editing after logging (delete + re-log to change equipment on a mistaken set) — this already exists for removing a set.

---

### Task 1: Data model — equipment moves onto `ExerciseSet`

**Files:**
- Modify: `src/lib/types.ts:33-59`
- Test: `src/lib/types.test.ts`
- Test: `src/lib/components/day-detail/DaySplitsExercises.test.ts` (append one test to the existing readonly-mode describe block)

**Interfaces:**
- Produces: `ExerciseSet`'s weight variant becomes `{ type?: 'weight'; weight: number; reps: number; equipment?: Equipment }`. `formatSet(set: ExerciseSet): string` appends ` BB`/` DB`/` CB`/` MC` when a weight set's `equipment` is set, otherwise unchanged (`60×8`).
- Consumes: nothing new (this task only touches `types.ts`; `Exercise.equipment` is left in place for now — Task 3 removes it once nothing reads it).

- [ ] **Step 1: Write failing tests for `formatSet` with equipment**

Add this test inside the existing `describe('formatSet', ...)` block in `src/lib/types.test.ts`, right after the `'formats a weight set as "weight×reps" with no unit'` test:

```ts
  it('formats a weight set with equipment as "weight×reps EQUIP"', () => {
    expect(formatSet({ type: 'weight', weight: 60, reps: 8, equipment: 'barbell' })).toBe('60×8 BB');
    expect(formatSet({ type: 'weight', weight: 60, reps: 8, equipment: 'dumbbell' })).toBe('60×8 DB');
    expect(formatSet({ type: 'weight', weight: 60, reps: 8, equipment: 'cable' })).toBe('60×8 CB');
    expect(formatSet({ type: 'weight', weight: 60, reps: 8, equipment: 'machine' })).toBe('60×8 MC');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/types.test.ts`
Expected: FAIL — the new test's assertions fail because `formatSet` doesn't apply an equipment suffix yet (it currently returns `'60×8'` for all four).

- [ ] **Step 3: Implement — add `equipment` to the weight variant and update `formatSet`**

In `src/lib/types.ts`, replace:

```ts
export type ExerciseSet =
  | { type?: 'weight'; weight: number; reps: number }
  | { type: 'bodyweight'; reps: number }
  | { type: 'time'; seconds: number };
```

with:

```ts
export type ExerciseSet =
  | { type?: 'weight'; weight: number; reps: number; equipment?: Equipment }
  | { type: 'bodyweight'; reps: number }
  | { type: 'time'; seconds: number };
```

Then replace:

```ts
export function formatSet(set: ExerciseSet): string {
  if (set.type === 'bodyweight') return `×${set.reps}`;
  if (set.type === 'time') return `${set.seconds}s`;
  return `${set.weight}×${set.reps}`; // 'weight', or legacy data with no type field at all
}
```

with:

```ts
const EQUIPMENT_ABBR: Record<Equipment, string> = {
  barbell: 'BB',
  dumbbell: 'DB',
  cable: 'CB',
  machine: 'MC',
};

export function formatSet(set: ExerciseSet): string {
  if (set.type === 'bodyweight') return `×${set.reps}`;
  if (set.type === 'time') return `${set.seconds}s`;
  const base = `${set.weight}×${set.reps}`; // 'weight', or legacy data with no type field at all
  return set.equipment ? `${base} ${EQUIPMENT_ABBR[set.equipment]}` : base;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/types.test.ts`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 5: Add an integration test confirming the readonly day summary picks up the new format**

`DaySplitsExercises.svelte`'s readonly summary already calls `formatSet` on every set, so no source change is needed there — this test confirms the wiring. Add it inside `describe('DaySplitsExercises — readonly mode', ...)` in `src/lib/components/day-detail/DaySplitsExercises.test.ts`, right after the `'shows bodyweight and time sets in the readonly summary with their own formats'` test:

```ts
  it('shows equipment abbreviation on a weight set in the readonly summary', () => {
    const weightExercise: Exercise[] = [
      { id: 'bench', name: 'Bench Press', deleted: false },
    ];
    const { getByText } = render(DaySplitsExercises, {
      props: {
        splits, exercises: weightExercise, selectedSplitIds: new Set<string>(),
        exerciseEntries: [
          { exerciseId: 'bench', sets: [{ type: 'weight', weight: 80, reps: 8, equipment: 'dumbbell' }] },
        ],
        readonly: true
      }
    });
    expect(getByText(/80×8 DB/)).toBeInTheDocument();
  });
```

Run: `npx vitest run src/lib/components/day-detail/DaySplitsExercises.test.ts`
Expected: PASS (this confirms the new format flows through existing wiring; it isn't a red-green cycle since no `DaySplitsExercises.svelte` code changes).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/types.test.ts src/lib/components/day-detail/DaySplitsExercises.test.ts
git commit -m "feat: add optional equipment field to weight-type ExerciseSet"
```

---

### Task 2: Logging UI — per-set equipment picker in `ExerciseEditor.svelte`

**Files:**
- Modify: `src/lib/components/day-detail/ExerciseEditor.svelte`
- Test: `src/lib/components/day-detail/ExerciseEditor.test.ts`

**Interfaces:**
- Consumes: `Equipment` type and the updated `ExerciseSet` weight variant (`equipment?: Equipment`) from `$lib/types`, produced in Task 1.
- Produces: `draftEquipment: Record<string, Equipment | undefined>` component state; `toggleEquipment(exerciseId: string, equipment: Equipment): void`. `logSet` now writes `equipment` on every weight-type set it creates (value may be `undefined`).

- [ ] **Step 1: Write failing tests**

In `src/lib/components/day-detail/ExerciseEditor.test.ts`, inside `describe('ExerciseEditor — exercise types', ...)`, replace the `weightWithEquipment` fixture and its two tests:

Replace:

```ts
  const weightWithEquipment: Exercise[] = [
    { id: 'row', name: 'Dumbbell Row', deleted: false, type: 'weight', equipment: 'dumbbell', singleArm: true },
  ];
```

with:

```ts
  const singleArmExercise: Exercise[] = [
    { id: 'row', name: 'Dumbbell Row', deleted: false, type: 'weight', singleArm: true },
  ];
```

Replace:

```ts
  it('shows equipment and single-arm as a suffix on the logged exercise name', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: weightWithEquipment, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Dumbbell Row'));
    expect(getByText('Dumbbell Row · Dumbbell · single-arm')).toBeInTheDocument();
  });

  it('does not add an equipment/single-arm suffix for a plain weight exercise', async () => {
    const plainWeightExercises: Exercise[] = [
      { id: 'bench', name: 'Bench Press', deleted: false },
    ];
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: plainWeightExercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    expect(getByText('Bench Press')).toBeInTheDocument();
  });
```

with:

```ts
  it('shows single-arm as a suffix on the logged exercise name', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: singleArmExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Dumbbell Row'));
    expect(getByText('Dumbbell Row · single-arm')).toBeInTheDocument();
  });

  it('does not add a single-arm suffix for a plain weight exercise', async () => {
    const plainWeightExercises: Exercise[] = [
      { id: 'bench', name: 'Bench Press', deleted: false },
    ];
    const { getByText } = render(ExerciseEditor, {
      props: { exercises: plainWeightExercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    expect(getByText('Bench Press')).toBeInTheDocument();
  });

  it('shows an equipment picker with 4 options for a weight-type exercise', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    expect(getByText('Barbell')).toBeInTheDocument();
    expect(getByText('Dumbbell')).toBeInTheDocument();
    expect(getByText('Cable')).toBeInTheDocument();
    expect(getByText('Machine')).toBeInTheDocument();
  });

  it('does not show the equipment picker for bodyweight or time exercises', async () => {
    const { getByText, queryByText } = render(ExerciseEditor, {
      props: { exercises: bodyweightExercise, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Push-up'));
    expect(queryByText('Barbell')).not.toBeInTheDocument();
  });

  it('logging a weight set with equipment selected shows the abbreviation on the chip', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Dumbbell'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('20×8 DB ✕')).toBeInTheDocument();
  });

  it('clicking a selected equipment pill again deselects it', async () => {
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Dumbbell'));
    await fireEvent.click(getByText('Dumbbell'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('20×8 ✕')).toBeInTheDocument();
  });

  it('pre-fills equipment from the last logged set for that exercise', async () => {
    const allDays: Record<string, DayEntry> = {
      '2026-06-05': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [{ type: 'weight', weight: 80, reps: 8, equipment: 'barbell' }] }] },
    };
    const { getByText } = render(ExerciseEditor, {
      props: { exercises, allDays, dateKey: '2026-06-10', userId: 'user1', entries: [] }
    });
    await fireEvent.click(getByText('+ Bench Press'));
    await fireEvent.click(getByText('Log Set'));
    expect(getByText('80×8 BB ✕')).toBeInTheDocument();
  });
```

(`exercises` here is the file-level fixture already declared at the top of `ExerciseEditor.test.ts` — `bench`/`squat`/`old`, no equipment field on any of them — and `bodyweightExercise` is the existing fixture already declared earlier in the `'ExerciseEditor — exercise types'` describe block.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/components/day-detail/ExerciseEditor.test.ts`
Expected: FAIL — the equipment-picker tests fail because there's no "Barbell"/"Dumbbell"/etc. text in the rendered output yet, and the label tests fail because the current `exerciseLabel` still reads `exercise.equipment`.

- [ ] **Step 3: Implement the equipment picker**

In `src/lib/components/day-detail/ExerciseEditor.svelte`, update the type import:

```ts
  import type { Exercise, ExerciseEntry, ExerciseSet, ExerciseType, Equipment, DayEntry } from '$lib/types';
```

Add an `EQUIPMENT_OPTIONS` constant and `draftEquipment` state, replacing:

```ts
  let draftWeight: Record<string, number> = {};
  let draftReps: Record<string, number> = {};
  let draftSeconds: Record<string, number> = {};
  let addingExercise = false;
```

with:

```ts
  const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
    { value: 'barbell', label: 'Barbell' },
    { value: 'dumbbell', label: 'Dumbbell' },
    { value: 'cable', label: 'Cable' },
    { value: 'machine', label: 'Machine' },
  ];

  let draftWeight: Record<string, number> = {};
  let draftReps: Record<string, number> = {};
  let draftSeconds: Record<string, number> = {};
  let draftEquipment: Record<string, Equipment | undefined> = {};
  let addingExercise = false;
```

Replace `exerciseLabel` (it no longer reads `exercise.equipment`):

```ts
  function exerciseLabel(exerciseId: string): string {
    const exercise = exerciseById[exerciseId];
    if (!exercise) return 'Unknown exercise';
    if ((exercise.type ?? 'weight') !== 'weight') return exercise.name;
    const parts: string[] = [];
    if (exercise.equipment) parts.push(exercise.equipment.charAt(0).toUpperCase() + exercise.equipment.slice(1));
    if (exercise.singleArm) parts.push('single-arm');
    return parts.length > 0 ? `${exercise.name} · ${parts.join(' · ')}` : exercise.name;
  }
```

with:

```ts
  function exerciseLabel(exerciseId: string): string {
    const exercise = exerciseById[exerciseId];
    if (!exercise) return 'Unknown exercise';
    const isWeightType = (exercise.type ?? 'weight') === 'weight';
    return isWeightType && exercise.singleArm ? `${exercise.name} · single-arm` : exercise.name;
  }
```

Replace `initDraftFor` to also pre-fill equipment:

```ts
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
```

with:

```ts
  function initDraftFor(exerciseId: string) {
    if (draftWeight[exerciseId] !== undefined) return;
    const last = getLastLoggedSet(allDays, exerciseId, dateKey);
    const lastWeight = last && 'weight' in last ? last.weight : undefined;
    const lastReps = last && 'reps' in last ? last.reps : undefined;
    const lastSeconds = last && 'seconds' in last ? last.seconds : undefined;
    const lastEquipment = last && 'equipment' in last ? last.equipment : undefined;
    draftWeight = { ...draftWeight, [exerciseId]: lastWeight ?? 20 };
    draftReps = { ...draftReps, [exerciseId]: lastReps ?? 8 };
    draftSeconds = { ...draftSeconds, [exerciseId]: lastSeconds ?? 30 };
    draftEquipment = { ...draftEquipment, [exerciseId]: lastEquipment };
  }
```

Add a `toggleEquipment` function right after `adjustSeconds`:

```ts
  function adjustSeconds(exerciseId: string, delta: number) {
    const next = Math.max(0, (draftSeconds[exerciseId] ?? 0) + delta);
    draftSeconds = { ...draftSeconds, [exerciseId]: next };
  }

  function toggleEquipment(exerciseId: string, equipment: Equipment) {
    const next = draftEquipment[exerciseId] === equipment ? undefined : equipment;
    draftEquipment = { ...draftEquipment, [exerciseId]: next };
  }
```

Replace `logSet` so weight-type sets carry the drafted equipment:

```ts
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
```

with:

```ts
  function logSet(exerciseId: string) {
    const type = typeOf(exerciseId);
    let set: ExerciseSet;
    if (type === 'bodyweight') {
      set = { type: 'bodyweight', reps: draftReps[exerciseId] ?? 0 };
    } else if (type === 'time') {
      set = { type: 'time', seconds: draftSeconds[exerciseId] ?? 0 };
    } else {
      set = {
        type: 'weight',
        weight: draftWeight[exerciseId] ?? 0,
        reps: draftReps[exerciseId] ?? 0,
        equipment: draftEquipment[exerciseId],
      };
    }
    entries = entries.map((e) =>
      e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, set] } : e
    );
  }
```

In the template, add the equipment picker row right before the existing steppers row. Replace:

```svelte
        <div class="flex items-center gap-2">
          {#if exType === 'weight'}
            <div class="flex items-center gap-1">
              <button
                type="button"
                use:holdRepeat={() => adjustWeight(ex.exerciseId, -2.5)}
```

with:

```svelte
        {#if exType === 'weight'}
          <div class="flex flex-wrap gap-1.5">
            {#each EQUIPMENT_OPTIONS as opt}
              <button
                type="button"
                on:click={() => toggleEquipment(ex.exerciseId, opt.value)}
                aria-pressed={draftEquipment[ex.exerciseId] === opt.value}
                class="px-2 py-1 text-xs border transition
                       {draftEquipment[ex.exerciseId] === opt.value
                         ? 'border-gb-light-green dark:border-gb-green text-gb-light-green dark:text-gb-green bg-gb-light-bg2 dark:bg-gb-bg2'
                         : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 hover:border-gb-light-blue dark:hover:border-gb-blue hover:text-gb-light-blue dark:hover:text-gb-blue'}"
              >{opt.label}</button>
            {/each}
          </div>
        {/if}

        <div class="flex items-center gap-2">
          {#if exType === 'weight'}
            <div class="flex items-center gap-1">
              <button
                type="button"
                use:holdRepeat={() => adjustWeight(ex.exerciseId, -2.5)}
```

(Everything after this anchor — the rest of the weight stepper, reps stepper, time stepper, and Log Set button — is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/components/day-detail/ExerciseEditor.test.ts`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/day-detail/ExerciseEditor.svelte src/lib/components/day-detail/ExerciseEditor.test.ts
git commit -m "feat: add per-set equipment picker to the exercise logging editor"
```

---

### Task 3: Remove equipment from the Exercise catalog (Settings, store, type)

**Files:**
- Modify: `src/routes/settings/+page.svelte`
- Modify: `src/lib/stores/exercises.ts`
- Test: `src/lib/stores/exercises.test.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: nothing new. By this point (after Task 2), nothing reads `exercise.equipment` outside of this task's own files.
- Produces: `Exercise` no longer has an `equipment` field. `updateExerciseEquipment` no longer exists.

- [ ] **Step 1: Remove the `updateExerciseEquipment` tests**

Delete these two tests from `src/lib/stores/exercises.test.ts` (currently between the `updateExerciseType` test and the `updateExerciseSingleArm` test):

```ts
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

```

- [ ] **Step 2: Run the store test file to confirm the remaining tests still pass**

Run: `npx vitest run src/lib/stores/exercises.test.ts`
Expected: PASS (this is a deletion, not new behavior — confirms removing these tests didn't break anything else in the file)

- [ ] **Step 3: Remove `updateExerciseEquipment` from the store**

In `src/lib/stores/exercises.ts`, replace:

```ts
import type { Exercise, ExerciseType, Equipment } from '$lib/types';
```

with:

```ts
import type { Exercise, ExerciseType } from '$lib/types';
```

And remove this function entirely:

```ts
export async function updateExerciseEquipment(userId: string, exerciseId: string, equipment: Equipment | null): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'exercises', exerciseId), { equipment });
}

```

- [ ] **Step 4: Remove the Equipment picker from Settings**

In `src/routes/settings/+page.svelte`, remove `updateExerciseEquipment` from the store import. Replace:

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

with:

```ts
  import {
    activeExercises,
    exercisesLoading,
    addExercise,
    deleteExercise,
    updateExerciseSplits,
    updateExerciseType,
    updateExerciseSingleArm,
  } from '$lib/stores/exercises';
```

Remove `Equipment` from the type import. Replace:

```ts
  import type { Exercise, GruvboxColor, ExerciseType, Equipment } from '$lib/types';
```

with:

```ts
  import type { Exercise, GruvboxColor, ExerciseType } from '$lib/types';
```

Remove the `EQUIPMENT_OPTIONS` constant entirely:

```ts
  const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
    { value: 'barbell', label: 'Barbell' },
    { value: 'dumbbell', label: 'Dumbbell' },
    { value: 'cable', label: 'Cable' },
    { value: 'machine', label: 'Machine' },
  ];

```

Remove the `handleSetExerciseEquipment` function entirely:

```ts
  function handleSetExerciseEquipment(exercise: Exercise, equipment: Equipment) {
    const next = exercise.equipment === equipment ? null : equipment;
    updateExerciseEquipment(userId, exercise.id, next).catch(() => showError());
  }

```

In the template, replace the block that renders the Equipment buttons alongside the Single-arm checkbox:

```svelte
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
```

with:

```svelte
                    {#if (exercise.type ?? 'weight') === 'weight'}
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
```

- [ ] **Step 5: Remove `equipment` from the `Exercise` interface**

In `src/lib/types.ts`, replace:

```ts
export interface Exercise {
  id: string;
  name: string;
  deleted: boolean;
  splitIds?: string[]; // splits this exercise belongs to; empty/undefined = available for any split
  type?: ExerciseType; // undefined = 'weight' (every exercise created before this field existed)
  equipment?: Equipment; // only meaningful when type is 'weight'; optional even then
  singleArm?: boolean; // only meaningful when type is 'weight'; purely descriptive
}
```

with:

```ts
export interface Exercise {
  id: string;
  name: string;
  deleted: boolean;
  splitIds?: string[]; // splits this exercise belongs to; empty/undefined = available for any split
  type?: ExerciseType; // undefined = 'weight' (every exercise created before this field existed)
  singleArm?: boolean; // only meaningful when type is 'weight'; purely descriptive
}
```

- [ ] **Step 6: Run full verification**

Run: `npm run check`
Expected: 0 errors

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/routes/settings/+page.svelte src/lib/stores/exercises.ts src/lib/stores/exercises.test.ts src/lib/types.ts
git commit -m "refactor: remove equipment from the Exercise catalog definition"
```
