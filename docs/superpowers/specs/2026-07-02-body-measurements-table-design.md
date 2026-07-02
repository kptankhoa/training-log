# Body Measurements Table — Design Spec
_2026-07-02_

## Overview

The Stats page has three related but distinct concerns crammed together: a weight/body-composition chart ("Metrics"), progress photos ("Photos"), and — new in this spec — a tape-measure body-measurements table ("Measurements": chest, waist, hip, limbs, etc.). This spec covers adding the new Measurements table, and splitting all three sections into independent components so `stats/+page.svelte` stops accumulating per-section state.

Context: the Stats page pill previously labeled "Measurements" was renamed to "Metrics" (it was always about scale/composition numbers: weight, muscle mass, fat mass, body fat %, score). That freed up the name "Measurements" for what it should actually mean — tape-measure body measurements — which is this feature.

---

## Architecture

`stats/+page.svelte` becomes a thin shell: it computes `userId` and renders the top-level pill row (`Metrics | Measurements | Photos`), then delegates to one self-contained component per pill:

- **`MetricsChart.svelte`** (new extraction) — the existing weight/muscle/fat/BFP/score chart, its metric-type sub-tabs (All/Weight/Muscle Mass/Fat Mass/Body Fat %/Score), its add-entry form, and its entries list. Takes `userId` as a prop; manages its own subscription to the existing `measurements` store (`onMount` + `initMeasurements`). This is a pure relocation of existing logic — no behavior changes.
- **`MeasurementsTable.svelte`** (new) — the body-circumference table this spec is actually about. Takes `userId` as a prop; owns a new `bodyMeasurements` store subscription, its own add-entry form, and the table.
- **`PhotoTimeline.svelte`** (unchanged) — still takes `days` as a prop from the shared `$allDays` store, since photos live on `DayEntry.photos` rather than their own collection.

Each component is independently testable, and the page file stops mixing all three sections' state together.

---

## Data Model (Firestore)

New collection, one doc per date, scoped under the user like every other collection in this app:

### `users/{userId}/bodyMeasurements/{YYYY-MM-DD}`
```
weight?:   number   # kg
chest?:    number   # cm
waist?:    number   # cm
handles?:  number   # cm (love handles)
hip?:      number   # cm
armL?:     number   # cm
forearmL?: number   # cm
armR?:     number   # cm
forearmR?: number   # cm
thighL?:   number   # cm
thighR?:   number   # cm
calfL?:    number   # cm
calfR?:    number   # cm
```

Every field is optional. A field that was never entered is **absent from the document**, not `0` and not `null` — this is what lets the table render it as `—` rather than a misleading zero. This is a deliberate departure from the existing Metrics entries, which default blank inputs to `0`.

`weight` here is intentionally independent from the `weight` field tracked by Metrics — no cross-referencing, no auto-fill. Both are separate values a user might log for the same date.

No changes to `firestore.rules` — the existing `match /users/{userId}/{document=**}` rule already covers any subcollection.

## Types (`src/lib/types.ts`)

```ts
export interface BodyMeasurementEntry {
  id: string; // date key YYYY-MM-DD
  weight?: number;
  chest?: number;
  waist?: number;
  handles?: number;
  hip?: number;
  armL?: number;
  forearmL?: number;
  armR?: number;
  forearmR?: number;
  thighL?: number;
  thighR?: number;
  calfL?: number;
  calfR?: number;
}
```

## Store (`src/lib/stores/bodyMeasurements.ts`)

Mirrors the shape of `src/lib/stores/measurements.ts`:

```ts
export const bodyMeasurements: Readable<BodyMeasurementEntry[]>;
export const bodyMeasurementsLoading: Readable<boolean>;
export function initBodyMeasurements(userId: string): () => void; // onSnapshot, sorted by id ascending
export function saveBodyMeasurement(
  userId: string,
  dateKey: string,
  data: Partial<Omit<BodyMeasurementEntry, 'id'>>
): Promise<void>; // setDoc(..., data, { merge: true })
export function deleteBodyMeasurement(userId: string, dateKey: string): Promise<void>;
```

`saveBodyMeasurement` takes a **partial** object. The caller (the add-entry form) is responsible for only including keys the user actually typed a value into — so saving never writes `undefined`, and re-saving the same date only adds/overwrites the fields provided, leaving previously-saved fields for that date untouched (`merge: true`).

---

## `MeasurementsTable.svelte` UI

**Add entry** (collapsed by default behind a "+ Add entry" toggle, same pattern as the existing Metrics form):
- Date picker, defaulting to today.
- 13 optional number inputs, grouped visually: Weight / Chest / Waist / Handles / Hip in one block, then Arm L / Arm R, Forearm L / Forearm R, Thigh L / Thigh R, Calf L / Calf R as paired rows.
- Save builds the partial payload from only non-blank inputs and calls `saveBodyMeasurement`.

**Table**:
- One row per entry, newest date first.
- Columns, in this exact order: `Date | Weight | Chest | Waist | Handles | Hip | Arm L | Forearm L | Arm R | Forearm R | Thigh L | Thigh R | Calf L | Calf R`.
- Blank/missing fields render as `—`.
- Wrapped in a horizontally-scrolling container (`overflow-x-auto`) since 14 columns don't fit a phone screen. The Date column is sticky (`sticky left-0`, opaque background matching the page) so it stays visible while scrolling.
- Each row ends with a `✕` delete button that deletes immediately (no confirm step) — matches the existing Metrics entries list behavior, not the confirm-to-delete pattern used elsewhere (photos, exercises).

**Empty state**: "No measurements yet" message, same tone/styling as the existing Metrics empty state.

**Loading**: existing `Spinner` component while `bodyMeasurementsLoading` is true.

---

## Testing

- `src/lib/stores/bodyMeasurements.test.ts` — init/populate/sort by date ascending, `saveBodyMeasurement` writes only the provided partial fields with `merge: true`, `deleteBodyMeasurement` deletes the right doc.
- `src/lib/components/MeasurementsTable.test.ts` — renders entries with dashes for missing fields, add-entry form only includes filled fields in the save payload, delete removes a row immediately.
- `src/lib/components/MetricsChart.test.ts` — `stats/+page.svelte` has no dedicated test file today, so this is a new file covering the relocated logic (chart rendering, metric sub-tab switching, add/delete entry) rather than a migration of existing tests. Behavior itself isn't changing, just its location.
- `stats/+page.svelte` doesn't need a test file after the split either — it becomes a thin pill-switch shell with no logic of its own to test.

---

## Out of Scope

- Editing a past entry's individual fields in place (re-adding the same date via the form is the only way to fill in more fields later).
- Charting the circumference measurements (this is a table-only view, unlike Metrics).
- Any relationship/sync between Measurements' `weight` and Metrics' `weight`.
- Unit conversion (cm only, no toggle to inches).
