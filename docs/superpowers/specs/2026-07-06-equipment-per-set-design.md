# Equipment Moves to Per-Set Design

## Problem

Equipment (`barbell` | `dumbbell` | `cable` | `machine`) currently lives on the `Exercise` catalog entry, set once in Settings and applying to every logged set of that exercise going forward. In practice, the same exercise is often done with different equipment across sessions (e.g. "Curl" with a barbell one day, dumbbells another), so a single fixed equipment value per exercise doesn't reflect reality. Equipment should instead be chosen when logging each individual set, the same way weight and reps already are.

Single-arm is *not* part of this change — it describes a distinct exercise variant (e.g. "Single-Arm Row" is arguably a different movement), not something that varies set-to-set, so it stays on the `Exercise` definition exactly as it is today.

## Data Model

### `src/lib/types.ts`

- `Exercise.equipment` is removed. `Exercise.singleArm` is unchanged.
- The weight variant of `ExerciseSet` gains an optional `equipment` field:

```ts
export type ExerciseSet =
  | { type?: 'weight'; weight: number; reps: number; equipment?: Equipment }
  | { type: 'bodyweight'; reps: number }
  | { type: 'time'; seconds: number };
```

`equipment` is optional — a set can be logged with no equipment chosen, same as today's exercise-level field being optional. Every pre-existing weight-set literal in the codebase (with no `equipment` key at all) remains valid with no edits required.

- `formatSet()` appends an abbreviation suffix when a weight set carries equipment:

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
  const base = `${set.weight}×${set.reps}`;
  return set.equipment ? `${base} ${EQUIPMENT_ABBR[set.equipment]}` : base;
}
```

Example: a barbell set of 60kg×8 renders `60×8 BB`; a set logged with no equipment renders `60×8`, unchanged from today.

### No migration

Existing `Exercise` documents in Firestore still contain a stray `equipment` field from the old model — it's simply never read again after this change ships. Existing logged sets never had per-set equipment and still won't show a suffix. Nothing needs to be backfilled.

## Logging UI — `ExerciseEditor.svelte`

- New `draftEquipment: Record<string, Equipment | undefined>` alongside the existing `draftWeight`/`draftReps`/`draftSeconds`.
- Shown only when the exercise being logged has type `'weight'`: a row of 4 pill buttons (Barbell, Dumbbell, Cable, Machine), placed above the existing weight/reps stepper row. Clicking a pill selects it (highlighted, filled); clicking the already-selected pill again deselects it back to "none" — the same click-again-to-clear pattern Settings currently uses for its (soon-removed) exercise-level equipment picker.
- `initDraftFor(exerciseId)` pre-fills `draftEquipment[exerciseId]` from the last logged set for that exercise (`getLastLoggedSet`), mirroring how weight/reps/seconds already pre-fill from history. If the last set had no equipment, the picker starts with nothing selected.
- `logSet(exerciseId)` includes `equipment: draftEquipment[exerciseId]` when building a weight-type set. `draftEquipment[exerciseId]` may be `undefined`, which is a valid value for the optional field.
- `exerciseLabel(exerciseId)` drops the equipment part of its suffix (equipment is no longer a fixed property of the exercise) but keeps the single-arm suffix, e.g. a single-arm exercise still shows `Row · single-arm`; a plain exercise shows just its name with no suffix at all now that equipment isn't catalog-level.

## Settings — `settings/+page.svelte`

- The "Equipment" picker block in the expanded exercise row is removed entirely.
- The "Type" and "Single-arm" controls are unchanged.
- `handleSetExerciseEquipment` and the `EQUIPMENT_OPTIONS` constant are removed from this file (equipment options move to `ExerciseEditor.svelte`, which is the only place that still needs them).

## Store — `src/lib/stores/exercises.ts`

- `updateExerciseEquipment` is deleted (nothing calls it after Settings' picker is removed).
- `updateExerciseType` and `updateExerciseSingleArm` are unchanged.

## Display

Both places that render logged sets — the set-logging chips in `ExerciseEditor.svelte` and the read-only day summary in `DaySplitsExercises.svelte` — already go through the shared `formatSet()`. No separate change is needed for either; both automatically pick up the new `20×8 DB`-style output once `formatSet` is updated.

## Testing

- `types.test.ts`: extend `formatSet` coverage with weight sets that have `equipment` set (each of the 4 values) and one with `equipment` omitted, asserting the suffix behavior above.
- `stores/exercises.test.ts`: remove the `updateExerciseEquipment` tests.
- `ExerciseEditor.test.ts`: add tests for — selecting an equipment pill and logging a set includes it; clicking a selected pill again deselects it; a new weight-type log pre-fills equipment from the last logged set for that exercise; the equipment row does not render for bodyweight/time exercises.
- `DaySplitsExercises.test.ts`: extend the existing readonly-summary formatting test with a weight set that has equipment, asserting the `DB`/`BB`/etc. suffix shows up in the summary text.
- No Settings page test changes (the page has no existing test file — a pre-existing, deliberate gap unrelated to this change).

## Out of Scope

- No per-set editing after logging (delete + re-log to change equipment on a mistaken set, consistent with existing set-editing behavior).
- No new equipment options beyond the existing 4 (`barbell`, `dumbbell`, `cable`, `machine`).
- Single-arm stays exercise-level, not per-set.
- No Firestore document migration or cleanup of stale `equipment` fields on `Exercise` documents.
