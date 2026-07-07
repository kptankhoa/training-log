# Subscription Tracking for Training Types — Design

## Problem

Training types (`TrainingTag`, managed in Settings) currently have no concept
of a paid subscription/membership period. The user wants to record when a
subscription for a given training type (e.g. a boxing gym membership) starts
and ends, see the end date highlighted on the calendar, and get a
dismissible reminder when a subscription is about to run out.

## Data Model

```ts
export interface SubscriptionPeriod {
  startDate: string;    // YYYY-MM-DD
  endDate?: string;     // YYYY-MM-DD; undefined = ongoing, end not known yet
  note?: string;        // freeform: gym/location, price, etc.
  dismissed?: boolean;  // reminder banner dismissed for this period
}

export interface TrainingTag {
  id: string;
  name: string;
  color: GruvboxColor;
  deleted: boolean;
  subscriptionPeriods?: SubscriptionPeriod[]; // new field
}
```

Periods have no `id` — deleted/edited by array index, the same convention
already used for `ExerciseSet` arrays (`sets.filter((_, i) => i !== setIndex)`
in `ExerciseEditor.svelte`). A training type can have any number of periods
over its lifetime (renewals); only the **latest** period (greatest
`startDate`) is ever shown on the calendar or in the reminder banner — past,
already-ended periods are just data, kept for the record but not displayed
outside Settings.

Whenever a period's `endDate` is edited to a new value through the Settings
UI, `dismissed` resets to `false` on that period — a changed end date is a
materially new deadline, so a previously-dismissed reminder should resurface
for it.

## Domain Logic

New file `src/lib/domain/subscriptions.ts` (pure functions, no Firestore/UI
dependency, alongside the existing `streaks.ts`/`exerciseHistory.ts`):

```ts
import type { TrainingTag, SubscriptionPeriod, GruvboxColor } from '$lib/types';

export function getLatestPeriod(periods: SubscriptionPeriod[]): SubscriptionPeriod | null {
  if (periods.length === 0) return null;
  return periods.reduce((latest, p) => (p.startDate > latest.startDate ? p : latest));
}

export interface ExpiringSubscription {
  tag: TrainingTag;
  period: SubscriptionPeriod;
  daysRemaining: number; // negative = already past the end date
}

export function getExpiringSoon(tags: TrainingTag[], now: Date = new Date()): ExpiringSubscription[] {
  const todayKey = toDateKey(now);
  const result: ExpiringSubscription[] = [];
  for (const tag of tags) {
    if (tag.deleted) continue;
    const latest = getLatestPeriod(tag.subscriptionPeriods ?? []);
    if (!latest?.endDate || latest.dismissed) continue;
    const daysRemaining = daysBetween(todayKey, latest.endDate);
    if (daysRemaining < 5) result.push({ tag, period: latest, daysRemaining });
  }
  return result;
}

export function getEndingColorsByDate(tags: TrainingTag[]): Record<string, GruvboxColor[]> {
  const map: Record<string, GruvboxColor[]> = {};
  for (const tag of tags) {
    if (tag.deleted) continue;
    const latest = getLatestPeriod(tag.subscriptionPeriods ?? []);
    if (latest?.endDate) (map[latest.endDate] ??= []).push(tag.color);
  }
  return map;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(fromKey + 'T00:00:00');
  const to = new Date(toKey + 'T00:00:00');
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
```

`getExpiringSoon`'s `< 5` threshold is inclusive of 0 and negative values —
an already-expired, not-yet-renewed subscription is exactly the case most
worth surfacing, not one to hide. Add both to the `src/lib/domain/index.ts`
barrel.

## Store

New function in `src/lib/stores/tags.ts`, mirroring the existing
whole-array-replacement pattern (`updateExerciseSplits`, `updateTagColor`):

```ts
export async function updateTagSubscriptionPeriods(
  userId: string,
  tagId: string,
  periods: SubscriptionPeriod[]
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'tags', tagId), { subscriptionPeriods: periods });
}
```

Callers (the two new components below) build the full updated array
(add/edit/delete/dismiss) and pass it to this one setter — the store stays a
thin CRUD wrapper, business logic lives in the components/domain layer,
consistent with the rest of the codebase.

## Settings UI

New `src/lib/components/settings/SubscriptionPeriods.svelte` (first
component in a new `settings/` feature folder — `settings/+page.svelte` is
already 446 lines, and this is exactly the kind of field-level extraction
CLAUDE.md's decomposition pattern calls for).

Props: `tag: TrainingTag`, `userId: string`.

Behavior:
- Renders `tag.subscriptionPeriods ?? []` sorted by `startDate` descending
  (latest first), each row showing:
  - Start date (`FormField type="date"`, editable inline, saves on change)
  - End date (`FormField type="date"`, editable inline; blank = ongoing).
    Changing this field's value also clears `dismissed` on that period.
  - Note (`FormField type="text"`, editable inline, saves on change)
  - Delete button, using the same click-to-confirm pattern already used for
    tag/exercise deletion (`confirmingIndex: number | null`, "✕" → "Confirm?"
    → delete on second click within 3s, matching `handleDeleteTagClick` in
    `settings/+page.svelte`)
- Below the list, an add-period form: Start (required), End (optional), Note
  (optional), "Add" button — disabled while Start is empty. Adding appends a
  new `{ startDate, endDate: endDate || undefined, note: note || undefined }`
  and clears the draft fields.
- Every mutation builds the new full array and calls
  `updateTagSubscriptionPeriods(userId, tag.id, periods).catch(() => showError())`.

In `settings/+page.svelte`, each tag's existing `<li>` row (color swatch,
name, delete) gets one more button using `icons.calendar` that toggles a
single `expandedTagId: string | null` (only one tag's panel open at a time,
matching the existing single-value `confirmingTagId` convention). When
`expandedTagId === tag.id`, render `<SubscriptionPeriods {tag} {userId} />`
in a `transition:slide` panel below that row.

## Calendar Highlight (corner ribbon)

In `Calendar.svelte`:

```ts
import { getEndingColorsByDate } from '$lib/domain';

$: endingColorsByDate = getEndingColorsByDate(tags);
```

`CellData` gains `endingColors: string[]` (resolved hex colors, same pattern
as the existing `colors`/`splitColors` fields), populated in the `cellData`
map via `(endingColorsByDate[key(cell.num)] ?? []).map((c) => $gruvboxColors[c])`.

The day-cell `<button>` needs `relative` added to its class list (it doesn't
have a position set today), so the ribbon can anchor to it. New markup
inside the button, rendered only when `cell.endingColors.length > 0`:

```svelte
<div class="absolute top-0 right-0 flex pointer-events-none" data-ending-count={cell.endingColors.length}>
  {#each cell.endingColors as color}
    <div style="width:0;height:0;border-style:solid;border-width:0 14px 14px 0;border-color:transparent {color} transparent transparent;"></div>
  {/each}
</div>
```

Multiple tags ending on the same day render multiple triangles side by side
along the top edge (flex row, right-anchored) rather than stacked/overlapping
— simplest to implement correctly and stays legible up to the small number
of training types this app realistically has. `pointer-events-none` keeps
the ribbon from interfering with clicking the day cell. `data-ending-count`
exists purely for test hookability, matching the existing
`data-has-note`/`data-has-photos`/`data-today` attribute convention — no
visual purpose.

The ribbon inherits the cell's existing opacity treatment for free (it's a
child of the same button that already gets `opacity-30` when a different
tag is selected in the legend filter) — no special-casing needed.

## Reminder Banner

New `src/lib/components/calendar/SubscriptionReminders.svelte`.

Props: `tags: TrainingTag[]`, `userId: string`.

```ts
import { getExpiringSoon } from '$lib/domain';
import { updateTagSubscriptionPeriods } from '$lib/stores/tags';
import { showError } from '$lib/stores/toast';

$: expiring = getExpiringSoon(tags);

function dismiss(tag: TrainingTag, period: SubscriptionPeriod) {
  const periods = (tag.subscriptionPeriods ?? []).map((p) =>
    p === period ? { ...p, dismissed: true } : p
  );
  updateTagSubscriptionPeriods(userId, tag.id, periods).catch(() => showError());
}
```

Renders one dismissible banner per entry in `expiring` (`{#each expiring as
{tag, period, daysRemaining} (tag.id)}`), each tinted with the tag's own
color (`$gruvboxColors[tag.color]`) so multiple simultaneous reminders stay
distinguishable, each with its own "✕ Dismiss" button calling `dismiss(tag,
period)`. Message text varies by `daysRemaining`:
- `> 0`: "{tag.name} ends in {daysRemaining} day{s}"
- `= 0`: "{tag.name} ends today"
- `< 0`: "{tag.name} ended {abs(daysRemaining)} day{s} ago"

`period.note` is appended in parentheses when present (e.g. "(Gold's Gym,
$50/mo)").

Rendered in `calendar/+page.svelte`, above `<Calendar ... />`. It reads
`$allDays`-independent, real "today" state (via `getExpiringSoon`'s default
`now = new Date()`), so it shows the same banners regardless of which month
the calendar grid is currently scrolled to — it is not affected by
`viewYear`/`viewMonth`.

## Testing

- `src/lib/domain/subscriptions.test.ts` (new): `getLatestPeriod` (empty →
  null, single period, picks greatest `startDate` among several);
  `getExpiringSoon` (excludes ongoing/no-`endDate` periods, excludes
  `dismissed` periods, excludes `daysRemaining >= 5`, includes exactly 4/0/
  negative days, excludes deleted tags, only considers each tag's latest
  period); `getEndingColorsByDate` (maps latest period's `endDate` to color,
  multiple tags on the same date produce multiple colors, non-latest periods
  are ignored).
- `src/lib/stores/tags.test.ts`: new test asserting
  `updateTagSubscriptionPeriods` calls `updateDoc` with the given array.
- `src/lib/components/settings/SubscriptionPeriods.test.ts` (new): renders
  existing periods; add a period with/without end date/note; delete a period
  (click-to-confirm); editing an existing period's end date calls the store
  with `dismissed` cleared on that period.
- `src/lib/components/calendar/SubscriptionReminders.test.ts` (new): renders
  a banner for an expiring tag; does not render for a tag with >= 5 days
  remaining or no `endDate`; dismiss button calls the store with `dismissed:
  true` on the right period; multiple expiring tags render multiple banners.
- `src/lib/components/calendar/Calendar.test.ts`: extend with a test
  asserting `data-ending-count` appears on the cell matching a tag's latest
  period's `endDate` and not on other cells; a second test for two tags
  ending on the same day producing `data-ending-count="2"`.

## Out of Scope

- No way to "un-dismiss" a reminder from the UI directly — editing that
  period's end date (which clears `dismissed`) is the only path back, and
  that's an intentional, sufficient escape hatch per the design above.
- No proactive notifications outside the app (push/email) — the reminder is
  only a banner shown while viewing `/calendar`.
- No editing/deleting of subscription periods from the calendar view itself
  — all period management stays in Settings.
- No change to `Exercise`, `DayEntry`, or any other existing type — this is
  additive to `TrainingTag` only.
- No Firestore migration — `subscriptionPeriods` is optional and defaults to
  an empty list (`?? []`) everywhere it's read, so existing tags without the
  field keep working unchanged.
