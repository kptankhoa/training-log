# Exercise Types Design

## Problem

Every exercise today is implicitly a weight×reps exercise (`ExerciseSet { weight: number; reps: number }`), whether it's a barbell squat, a bodyweight push-up, or a plank. There's no way to log a plank's duration, or a push-up's rep count without a meaningless "weight" field attached to it.

## Goal

Let an exercise be marked as one of three types — `weight`, `bodyweight`, `time` — which changes what a logged set records for it. Weight exercises additionally get an optional equipment tag and a single-arm flag, both purely descriptive.

## Data model

`src/lib/types.ts`:

```ts
export type ExerciseType = 'weight' | 'bodyweight' | 'time';
export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine';

export interface Exercise {
  id: string;
  name: string;
  deleted: boolean;
  splitIds?: string[];
  type?: ExerciseType;      // undefined = 'weight' (every exercise that existed before this shipped)
  equipment?: Equipment;    // only meaningful when type is 'weight'; optional even then
  singleArm?: boolean;      // only meaningful when type is 'weight'; purely descriptive
}

export type ExerciseSet =
  | { type?: 'weight'; weight: number; reps: number }
  | { type: 'bodyweight'; reps: number }
  | { type: 'time'; seconds: number };

// Every set logged before this shipped is a bare `{ weight, reps }` with no
// `type` field at all. Rather than migrating stored documents or force-casting
// legacy literals, `type` is optional specifically on the weight variant —
// `{ weight: 60, reps: 8 }` is a genuinely valid ExerciseSet with no cast
// needed, so every existing test file's set literals keep type-checking
// unmodified. Every newly logged set still always writes a real `type`
// explicitly (see the logging changes below); the optional case only ever
// matters for reading pre-existing history.
export function resolveSetType(set: ExerciseSet): ExerciseType {
  return set.type ?? 'weight';
}

export function formatSet(set: ExerciseSet): string {
  if (set.type === 'bodyweight') return `×${set.reps}`;
  if (set.type === 'time') return `${set.seconds}s`;
  return `${set.weight}×${set.reps}`; // 'weight', or legacy data with no type field at all
}
```

Two corrections from this spec's first draft: the weight case is `"60×8"`, not `"60kg×8"` — the actual existing compact display (both the set chips in `ExerciseEditor.svelte` and the read-only summary in `DaySplitsExercises.svelte`, confirmed against their current tests) has never included a unit suffix; only the *live editable stepper* shows `"20kg"` as its own separate label. And `type` is optional on the weight variant (not required on all three) for the backward-compatibility reason described above — this was caught during implementation planning, when it became clear a strictly-required `type` would force edits to dozens of unrelated existing test literals across the codebase just to keep them compiling.

`Exercise.type` has no equivalent resolver function — it's a single optional field, read inline as `exercise.type ?? 'weight'`, matching the existing `splitIds` precedent exactly.

**Type changes don't touch history.** A set's `type` is fixed at the moment it's logged. Changing an exercise's type in Settings only affects sets logged *after* the change — existing sets keep displaying and behaving as whatever type they were logged under. If a set was logged wrong, the fix is to delete it (already possible today) and re-log it under the exercise's current type — no new "edit a set in place" UI is being added.

**Equipment and single-arm survive type changes.** Switching an exercise away from `weight` and back doesn't clear a previously-set `equipment` or `singleArm` value — they just stop being shown/used while the type is something else.

## Store functions

`src/lib/stores/exercises.ts` gains three functions, matching the existing `updateExerciseSplits` shape (one function per field, a single `updateDoc` call each):

```ts
export async function updateExerciseType(userId: string, exerciseId: string, type: ExerciseType): Promise<void>;
export async function updateExerciseEquipment(userId: string, exerciseId: string, equipment: Equipment | null): Promise<void>;
export async function updateExerciseSingleArm(userId: string, exerciseId: string, singleArm: boolean): Promise<void>;
```

`updateExerciseEquipment` takes `Equipment | null` — `null` clears it back to "none", stored as a literal `null` value via a plain `updateDoc(..., { equipment: null })` (this codebase doesn't use Firestore's `deleteField()` anywhere, so no new pattern is introduced). Every read site treats `exercise.equipment ?? undefined` the same way regardless of whether the field is `null` or was never set at all.

A newly-created exercise (via `addExercise`, including the quick-add during logging) gets no `type`, `equipment`, or `singleArm` at all — identical to every pre-existing exercise. You'd set its real type afterward in Settings if it isn't a plain weight exercise.

## Settings → Exercises editor

In the existing expanded exercise row (`src/routes/settings/+page.svelte`, same place "Tied to splits" toggles live today), add two new rows above the splits row:

**Type** — three buttons styled like the existing split-toggle chips: `Weight` / `Bodyweight` / `Time`. Exactly one is always selected (defaults to `weight` when `exercise.type` is undefined). Clicking calls `updateExerciseType`.

**Equipment** (only rendered when the exercise's type is `weight`) — four buttons: `Barbell` / `Dumbbell` / `Cable` / `Machine`. Unlike Type, this one is optional: clicking the currently-selected equipment again clears it (calls `updateExerciseEquipment(userId, id, null)`).

**Single-arm** (only rendered when the exercise's type is `weight`) — a small checkbox below the Equipment row, labeled "Single-arm". Calls `updateExerciseSingleArm` on change.

All three follow the existing `toggleExerciseSplit`-style handlers: wrapped in try/catch, showing the shared `showError()` toast on failure (matching the rest of the app's error-handling convention).

## Logging (`ExerciseEditor.svelte`)

The stepper row for each logged exercise becomes type-aware, keyed off `exercise.type ?? 'weight'` (looked up from the `exercises` catalog prop, not from any already-logged set):

- **weight**: unchanged from today — weight stepper (±2.5kg, floor 0) + reps stepper (±1, floor 1) + Log Set button.
- **bodyweight**: reps stepper only (±1, floor 1) + Log Set button. No weight stepper.
- **time**: a single duration stepper — seconds, ±5, floor 0 — + Log Set button. No weight or reps stepper.

Drafts extend from today's `draftWeight`/`draftReps` (`Record<string, number>` keyed by exerciseId) to add `draftSeconds: Record<string, number>`. `initDraftFor` seeds whichever draft(s) are relevant for the exercise's type from `getLastLoggedSet` (falling back to today's defaults for weight/reps, and 30s for a first-ever time set).

`logSet(exerciseId)` builds the `ExerciseSet` object matching the exercise's current type (reading its type from the `exercises` catalog, same lookup as the stepper), always including the `type` field.

Set chips (the existing tap-to-remove pills showing each logged set) render via the new `formatSet()` helper instead of the hardcoded `${weight}×${reps}` template — `"60×8"`, `"×8"`, `"45s"`.

The exercise name label in the logging list (not the "+ ExerciseName" pickable buttons, which stay name-only to keep that row compact) gets a muted suffix when type is `weight` and equipment and/or `singleArm` are set: `" · {Equipment}"` and/or `" · single-arm"`, e.g. "Dumbbell Row · Dumbbell · single-arm" or "Bench Press · Barbell". Equipment labels are the capitalized display form (`Barbell`, `Dumbbell`, `Cable`, `Machine`) of the stored lowercase value.

## Read-only display (`DaySplitsExercises.svelte`)

The summary line (`exercise — 60×8, 60×8`) switches from its own hardcoded template to `ex.sets.map(formatSet).join(', ')`, automatically picking up all three formats with no per-type branching needed at this call site.

## Testing

- `types.ts` gets a new co-located `types.test.ts` (doesn't exist yet) covering `resolveSetType` (including the no-`type` legacy fallback) and `formatSet` for all three set shapes.
- `exercises.test.ts`: add cases for `updateExerciseType`, `updateExerciseEquipment` (including clearing with `null`), `updateExerciseSingleArm`.
- `ExerciseEditor.test.ts`: add cases for logging a bodyweight set (reps-only stepper, no weight stepper rendered) and a time set (seconds stepper, no weight/reps steppers rendered), plus that set chips render via the new formats.
- `DaySplitsExercises.test.ts`: add a case asserting the summary line renders bodyweight (`×8`) and time (`45s`) sets correctly alongside existing weight-set coverage.
- No new test file for the Settings page (it has no existing test file at all — a pre-existing gap noted previously in this project, not something this feature is expected to fix).

## Out of scope

- Editing an already-logged set in place (delete + re-log covers the "I logged it wrong" case).
- Per-arm (left/right) tracking for single-arm exercises — it's a descriptive tag only.
- Any equipment list beyond barbell/dumbbell/cable/machine.
- Migrating existing Firestore documents to add explicit `type` fields — legacy data is handled entirely via `resolveSetType`'s fallback.
