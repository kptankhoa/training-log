# Subscription Tracking for Training Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each training type (`TrainingTag`) track subscription periods (start/end date + note), highlight the latest period's end date on the calendar with a corner ribbon, and show a dismissible "days remaining" reminder banner on the calendar page.

**Architecture:** A new optional `subscriptionPeriods` array on `TrainingTag`, three pure functions in a new `src/lib/domain/subscriptions.ts`, one new store setter (`updateTagSubscriptionPeriods`), a new Settings component for managing periods, a new Calendar-page component for the reminder banner, and small additive changes to `Calendar.svelte` for the ribbon.

**Tech Stack:** SvelteKit 2, Svelte 5 legacy syntax, Firestore, Vitest + @testing-library/svelte.

## Global Constraints

- `SubscriptionPeriod { startDate: string; endDate?: string; note?: string; dismissed?: boolean }` — dates are `YYYY-MM-DD` strings. No `id` field; deleted/edited by array index (same convention as `ExerciseSet` arrays).
- Only a tag's **latest** period (greatest `startDate`) is ever shown on the calendar ribbon or considered for the reminder banner. Older periods are data-only, visible in Settings, never displayed elsewhere.
- **Critical Firestore gotcha (already burned us once — see `CLAUDE.md`'s "Exercise types" section and commit `4c2d1c3`): `initializeFirestore` in `src/lib/firebase/index.ts` does not set `ignoreUndefinedProperties: true`, so any write containing a literal `undefined` value throws, silently swallowed by the caller's `.catch()`, causing silent data loss.** Every place that builds a `SubscriptionPeriod` object (adding a period with a blank end date/note, or clearing an existing one) MUST omit the `endDate`/`note` key entirely when empty — never assign `endDate: undefined`. Task 2 includes dedicated structural tests for this (`'key' in obj`, not just checking rendered text) because a text-only test cannot catch this class of bug.
- Reminder threshold is `daysRemaining < 5`, computed as `endDate - today` in whole days. This is inclusive of 0 and negative values (already-expired periods still show a reminder) — not an off-by-one to fix later.
- Dismissing a reminder sets `dismissed: true` on that specific period and persists via Firestore (not local-only). Editing that same period's `endDate` to a new value clears `dismissed` back to `false`, since a changed end date is a new deadline.
- The reminder banner is based on the real current date, not on which month the calendar grid is currently scrolled to — it must not depend on `viewYear`/`viewMonth`.
- No changes to `calendar/+page.svelte`'s `Calendar` component props/events beyond what's specified below, and no Firestore migration — `subscriptionPeriods` is optional and read as `?? []` everywhere.

---

### Task 1: Data model, domain logic, and store

**Files:**
- Modify: `src/lib/types/index.ts`
- Create: `src/lib/domain/subscriptions.ts`
- Modify: `src/lib/domain/index.ts`
- Modify: `src/lib/stores/tags.ts`
- Test: `src/lib/domain/subscriptions.test.ts` (new)
- Test: `src/lib/stores/tags.test.ts`

**Interfaces:**
- Produces (for Tasks 2-4 to consume): `SubscriptionPeriod` and updated `TrainingTag` types (`$lib/types`); `getLatestPeriod(periods: SubscriptionPeriod[]): SubscriptionPeriod | null`, `getExpiringSoon(tags: TrainingTag[], now?: Date): { tag: TrainingTag; period: SubscriptionPeriod; daysRemaining: number }[]`, `getEndingColorsByDate(tags: TrainingTag[]): Record<string, GruvboxColor[]>` (all exported from `$lib/domain`); `updateTagSubscriptionPeriods(userId: string, tagId: string, periods: SubscriptionPeriod[]): Promise<void>` (from `$lib/stores/tags`).

- [ ] **Step 1: Write the failing domain tests**

Create `src/lib/domain/subscriptions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getLatestPeriod, getExpiringSoon, getEndingColorsByDate } from './subscriptions';
import type { TrainingTag } from '$lib/types';

describe('getLatestPeriod', () => {
  it('returns null for an empty array', () => {
    expect(getLatestPeriod([])).toBeNull();
  });

  it('returns the only period when there is one', () => {
    const period = { startDate: '2026-01-01' };
    expect(getLatestPeriod([period])).toBe(period);
  });

  it('returns the period with the greatest startDate among several, regardless of array order', () => {
    const older = { startDate: '2026-01-01', endDate: '2026-03-31' };
    const newer = { startDate: '2026-04-01' };
    expect(getLatestPeriod([older, newer])).toBe(newer);
    expect(getLatestPeriod([newer, older])).toBe(newer);
  });
});

function tag(overrides: Partial<TrainingTag> = {}): TrainingTag {
  return { id: 'tag1', name: 'Boxing', color: 'red', deleted: false, ...overrides };
}

describe('getExpiringSoon', () => {
  const now = new Date('2026-07-07T12:00:00');

  it('excludes a tag with no subscriptionPeriods', () => {
    expect(getExpiringSoon([tag()], now)).toEqual([]);
  });

  it('excludes an ongoing period with no endDate', () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-07-01' }] });
    expect(getExpiringSoon([t], now)).toEqual([]);
  });

  it('excludes a period ending 5 or more days from now', () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-12' }] });
    expect(getExpiringSoon([t], now)).toEqual([]);
  });

  it('includes a period ending exactly 4 days from now', () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-11' }] });
    const result = getExpiringSoon([t], now);
    expect(result).toEqual([{ tag: t, period: t.subscriptionPeriods![0], daysRemaining: 4 }]);
  });

  it('includes a period ending today with daysRemaining 0', () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-07' }] });
    expect(getExpiringSoon([t], now)[0].daysRemaining).toBe(0);
  });

  it('includes an already-expired period with a negative daysRemaining', () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-06-01', endDate: '2026-07-05' }] });
    expect(getExpiringSoon([t], now)[0].daysRemaining).toBe(-2);
  });

  it('excludes a dismissed period even if ending soon', () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-08', dismissed: true }] });
    expect(getExpiringSoon([t], now)).toEqual([]);
  });

  it('excludes a deleted tag', () => {
    const t = tag({ deleted: true, subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-08' }] });
    expect(getExpiringSoon([t], now)).toEqual([]);
  });

  it('only considers the latest period, ignoring an older ending-soon period', () => {
    const t = tag({
      subscriptionPeriods: [
        { startDate: '2026-01-01', endDate: '2026-07-08' }, // older; would be "expiring soon" alone
        { startDate: '2026-07-01' }, // latest, ongoing
      ],
    });
    expect(getExpiringSoon([t], now)).toEqual([]);
  });
});

describe('getEndingColorsByDate', () => {
  it("maps the latest period's endDate to the tag color", () => {
    const t = tag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-07-15' }] });
    expect(getEndingColorsByDate([t])).toEqual({ '2026-07-15': ['red'] });
  });

  it('collects colors from multiple tags ending on the same date', () => {
    const t1 = tag({ id: 'tag1', color: 'red', subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-07-15' }] });
    const t2 = tag({ id: 'tag2', color: 'blue', subscriptionPeriods: [{ startDate: '2026-02-01', endDate: '2026-07-15' }] });
    expect(getEndingColorsByDate([t1, t2])).toEqual({ '2026-07-15': ['red', 'blue'] });
  });

  it("ignores a non-latest period's endDate", () => {
    const t = tag({
      subscriptionPeriods: [
        { startDate: '2026-01-01', endDate: '2026-03-31' },
        { startDate: '2026-04-01', endDate: '2026-09-30' },
      ],
    });
    expect(getEndingColorsByDate([t])).toEqual({ '2026-09-30': ['red'] });
  });

  it('excludes an ongoing latest period and a deleted tag', () => {
    const ongoing = tag({ id: 'tag1', subscriptionPeriods: [{ startDate: '2026-07-01' }] });
    const deleted = tag({ id: 'tag2', deleted: true, subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-07-15' }] });
    expect(getEndingColorsByDate([ongoing, deleted])).toEqual({});
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/domain/subscriptions.test.ts`
Expected: FAIL — `Cannot find module './subscriptions'` (the file doesn't exist yet).

- [ ] **Step 3: Add the types**

In `src/lib/types/index.ts`, change:

```ts
export interface TrainingTag {
  id: string;
  name: string;
  color: GruvboxColor;
  deleted: boolean;
}
```

to:

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
  subscriptionPeriods?: SubscriptionPeriod[];
}
```

- [ ] **Step 4: Implement the domain functions**

Create `src/lib/domain/subscriptions.ts`:

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

Add to `src/lib/domain/index.ts`:

```ts
export * from './streaks';
export * from './exerciseHistory';
export * from './subscriptions';
```

- [ ] **Step 5: Run the domain tests to verify they pass**

Run: `npx vitest run src/lib/domain/subscriptions.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Write the failing store test**

Add to `src/lib/stores/tags.test.ts`, after the existing `updateTagColor` test (before the closing `});` of the describe block):

```ts
  it('updateTagSubscriptionPeriods calls updateDoc with the given periods array', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateTagSubscriptionPeriods } = await import('./tags');
    const periods = [{ startDate: '2026-01-01', endDate: '2026-03-31' }];
    await updateTagSubscriptionPeriods('user1', 'tag1', periods);
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { subscriptionPeriods: periods });
  });
```

- [ ] **Step 7: Run the store test to verify it fails**

Run: `npx vitest run src/lib/stores/tags.test.ts`
Expected: FAIL — `updateTagSubscriptionPeriods is not a function` (not exported yet).

- [ ] **Step 8: Implement the store function**

In `src/lib/stores/tags.ts`, change the type import:

```ts
import type { TrainingTag, GruvboxColor } from '$lib/types';
```

to:

```ts
import type { TrainingTag, GruvboxColor, SubscriptionPeriod } from '$lib/types';
```

Then add, after the existing `updateTagColor` function:

```ts
export async function updateTagSubscriptionPeriods(
  userId: string,
  tagId: string,
  periods: SubscriptionPeriod[]
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'tags', tagId), { subscriptionPeriods: periods });
}
```

- [ ] **Step 9: Run both test files to verify everything passes, then type-check**

Run: `npx vitest run src/lib/domain/subscriptions.test.ts src/lib/stores/tags.test.ts`
Expected: all tests PASS.

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 10: Commit**

```bash
git add src/lib/types/index.ts src/lib/domain/subscriptions.ts src/lib/domain/index.ts src/lib/domain/subscriptions.test.ts src/lib/stores/tags.ts src/lib/stores/tags.test.ts
git commit -m "feat: add subscription period data model, domain logic, and store setter"
```

---

### Task 2: Settings UI for managing subscription periods

**Files:**
- Create: `src/lib/components/settings/SubscriptionPeriods.svelte`
- Test: `src/lib/components/settings/SubscriptionPeriods.test.ts` (new)
- Modify: `src/routes/settings/+page.svelte`

**Interfaces:**
- Consumes (from Task 1): `updateTagSubscriptionPeriods(userId, tagId, periods)` from `$lib/stores/tags`; `SubscriptionPeriod`/`TrainingTag` types from `$lib/types`.
- Consumes (pre-existing): `FormField` (`$lib/components/shared/FormField.svelte`, props `id`/`label`/`type`/`value` with `bind:value` support), `showError` (`$lib/stores/toast`), `icons.calendar` (`$lib/theme`).
- Produces: `SubscriptionPeriods.svelte` with props `tag: TrainingTag`, `userId: string` — no events, calls the store directly (matching `DayTagsField.svelte`'s existing pattern of importing and calling store functions directly rather than dispatching to a parent).

- [ ] **Step 1: Write the failing component tests**

Create `src/lib/components/settings/SubscriptionPeriods.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SubscriptionPeriods from './SubscriptionPeriods.svelte';
import type { TrainingTag } from '$lib/types';

const mockUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/stores/tags', () => ({
  updateTagSubscriptionPeriods: (...args: unknown[]) => mockUpdate(...args),
}));

function baseTag(overrides: Partial<TrainingTag> = {}): TrainingTag {
  return { id: 'tag1', name: 'Boxing', color: 'red', deleted: false, ...overrides };
}

describe('SubscriptionPeriods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders existing periods with their start and end dates', () => {
    const tag = baseTag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-03-31' }] });
    const { getByDisplayValue } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    expect(getByDisplayValue('2026-01-01')).toBeInTheDocument();
    expect(getByDisplayValue('2026-03-31')).toBeInTheDocument();
  });

  it('adding a period with only a start date calls the store with endDate and note entirely absent (not undefined)', async () => {
    const tag = baseTag({ subscriptionPeriods: [] });
    const { getByLabelText, getByText } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.input(getByLabelText('Start'), { target: { value: '2026-07-01' } });
    await fireEvent.click(getByText('Add period'));
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const savedPeriods = mockUpdate.mock.calls[0][2];
    expect(savedPeriods).toEqual([{ startDate: '2026-07-01' }]);
    expect('endDate' in savedPeriods[0]).toBe(false);
    expect('note' in savedPeriods[0]).toBe(false);
  });

  it('adding a period with an end date and note includes both', async () => {
    const tag = baseTag({ subscriptionPeriods: [] });
    const { getByLabelText, getByText } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.input(getByLabelText('Start'), { target: { value: '2026-07-01' } });
    await fireEvent.input(getByLabelText('End (optional)'), { target: { value: '2026-08-01' } });
    await fireEvent.input(getByLabelText('Note (optional)'), { target: { value: "Gold's Gym" } });
    await fireEvent.click(getByText('Add period'));
    expect(mockUpdate).toHaveBeenCalledWith('user1', 'tag1', [
      { startDate: '2026-07-01', endDate: '2026-08-01', note: "Gold's Gym" },
    ]);
  });

  it('does not add a period when the start date is blank', async () => {
    const tag = baseTag({ subscriptionPeriods: [] });
    const { getByText } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.click(getByText('Add period'));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("editing an existing period's end date calls the store with the new value and clears dismissed", async () => {
    const tag = baseTag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-03-31', dismissed: true }] });
    const { getByDisplayValue } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.change(getByDisplayValue('2026-03-31'), { target: { value: '2026-04-30' } });
    expect(mockUpdate).toHaveBeenCalledWith('user1', 'tag1', [
      { startDate: '2026-01-01', endDate: '2026-04-30', dismissed: false },
    ]);
  });

  it("clearing an existing period's end date removes the key entirely rather than setting it to undefined", async () => {
    const tag = baseTag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-03-31' }] });
    const { getByDisplayValue } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.change(getByDisplayValue('2026-03-31'), { target: { value: '' } });
    const savedPeriods = mockUpdate.mock.calls[0][2];
    expect('endDate' in savedPeriods[0]).toBe(false);
  });

  it('clicking delete twice removes the period', async () => {
    const tag = baseTag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-03-31' }] });
    const { getByLabelText } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.click(getByLabelText('Delete period'));
    await fireEvent.click(getByLabelText('Confirm delete period'));
    expect(mockUpdate).toHaveBeenCalledWith('user1', 'tag1', []);
  });

  it('a single click on delete does not remove the period yet', async () => {
    const tag = baseTag({ subscriptionPeriods: [{ startDate: '2026-01-01', endDate: '2026-03-31' }] });
    const { getByLabelText } = render(SubscriptionPeriods, { props: { tag, userId: 'user1' } });
    await fireEvent.click(getByLabelText('Delete period'));
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/components/settings/SubscriptionPeriods.test.ts`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/settings/SubscriptionPeriods.svelte`:

```svelte
<script lang="ts">
  import { updateTagSubscriptionPeriods } from '$lib/stores/tags';
  import { showError } from '$lib/stores/toast';
  import FormField from '$lib/components/shared/FormField.svelte';
  import type { TrainingTag, SubscriptionPeriod } from '$lib/types';

  export let tag: TrainingTag;
  export let userId: string;

  $: periods = tag.subscriptionPeriods ?? [];
  $: sortedIndices = periods
    .map((_, i) => i)
    .sort((a, b) => (periods[a].startDate > periods[b].startDate ? -1 : 1));

  let newStart = '';
  let newEnd = '';
  let newNote = '';

  let confirmingIndex: number | null = null;
  let confirmTimeout: ReturnType<typeof setTimeout> | null = null;

  function save(next: SubscriptionPeriod[]) {
    updateTagSubscriptionPeriods(userId, tag.id, next).catch(() => showError());
  }

  function addPeriod() {
    const startDate = newStart.trim();
    if (!startDate) return;
    const period: SubscriptionPeriod = { startDate };
    const endDate = newEnd.trim();
    const note = newNote.trim();
    if (endDate) period.endDate = endDate;
    if (note) period.note = note;
    save([...periods, period]);
    newStart = '';
    newEnd = '';
    newNote = '';
  }

  function updateField(index: number, field: 'startDate' | 'endDate' | 'note', value: string) {
    const next = periods.map((p, i) => {
      if (i !== index) return p;
      if (field === 'startDate') return { ...p, startDate: value };
      if (field === 'endDate') {
        const { endDate, ...rest } = p;
        return value ? { ...rest, endDate: value, dismissed: false } : { ...rest, dismissed: false };
      }
      const { note, ...rest } = p;
      return value ? { ...rest, note: value } : rest;
    });
    save(next);
  }

  function handleDeleteClick(index: number) {
    if (confirmingIndex === index) {
      if (confirmTimeout) clearTimeout(confirmTimeout);
      confirmingIndex = null;
      save(periods.filter((_, i) => i !== index));
      return;
    }
    confirmingIndex = index;
    if (confirmTimeout) clearTimeout(confirmTimeout);
    confirmTimeout = setTimeout(() => { confirmingIndex = null; }, 3000);
  }
</script>

<div class="flex flex-col gap-3 px-4 pb-3">
  {#if periods.length > 0}
    <ul class="flex flex-col gap-2">
      {#each sortedIndices as index (index)}
        <li class="flex flex-col gap-2 bg-gb-light-bg2 dark:bg-gb-bg2 p-3">
          <div class="flex items-center gap-2">
            <input
              type="date"
              aria-label="Start date"
              value={periods[index].startDate}
              on:change={(e) => updateField(index, 'startDate', e.currentTarget.value)}
              class="bg-gb-light-bg1 dark:bg-gb-bg1 text-gb-light-fg dark:text-gb-fg text-sm px-2 py-1 border border-gb-light-bg3 dark:border-gb-bg3 focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
            />
            <span class="text-gb-light-fg3 dark:text-gb-fg3 text-xs">&rarr;</span>
            <input
              type="date"
              aria-label="End date (blank = ongoing)"
              value={periods[index].endDate ?? ''}
              on:change={(e) => updateField(index, 'endDate', e.currentTarget.value)}
              class="bg-gb-light-bg1 dark:bg-gb-bg1 text-gb-light-fg dark:text-gb-fg text-sm px-2 py-1 border border-gb-light-bg3 dark:border-gb-bg3 focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
            />
            <button
              type="button"
              on:click={() => handleDeleteClick(index)}
              aria-label={confirmingIndex === index ? 'Confirm delete period' : 'Delete period'}
              class="text-xs font-medium px-2 py-1 transition-colors shrink-0
                     {confirmingIndex === index ? 'text-white bg-gb-light-red dark:bg-gb-red' : 'text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-red dark:hover:text-gb-red'}"
            >{confirmingIndex === index ? 'Confirm?' : '✕'}</button>
          </div>
          <input
            type="text"
            aria-label="Note"
            placeholder="Gym / location / price"
            value={periods[index].note ?? ''}
            on:change={(e) => updateField(index, 'note', e.currentTarget.value)}
            class="bg-gb-light-bg1 dark:bg-gb-bg1 text-gb-light-fg dark:text-gb-fg text-sm px-2 py-1 border border-gb-light-bg3 dark:border-gb-bg3 focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue"
          />
        </li>
      {/each}
    </ul>
  {/if}

  <div class="flex items-end gap-2">
    <FormField id="sub-new-start-{tag.id}" label="Start" type="date" bind:value={newStart} />
    <FormField id="sub-new-end-{tag.id}" label="End (optional)" type="date" bind:value={newEnd} />
  </div>
  <FormField id="sub-new-note-{tag.id}" label="Note (optional)" type="text" bind:value={newNote} />
  <button
    type="button"
    on:click={addPeriod}
    disabled={!newStart.trim()}
    class="bg-gb-light-blue dark:bg-gb-blue text-gb-light-bg dark:text-gb-bg font-semibold px-4 py-2 hover:opacity-90 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed self-start"
  >Add period</button>
</div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/components/settings/SubscriptionPeriods.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Wire it into the Settings page**

In `src/routes/settings/+page.svelte`, add the import (alongside the other component imports):

```ts
import SubscriptionPeriods from '$lib/components/settings/SubscriptionPeriods.svelte';
```

Add state, near the existing `let expandedExerciseId: string | null = null;`:

```ts
let expandedTagId: string | null = null;

function toggleTagExpand(tagId: string) {
  expandedTagId = expandedTagId === tagId ? null : tagId;
}
```

Change the tag list item template from:

```svelte
            {#each $activeTags as tag (tag.id)}
              <li class="flex items-center gap-3 bg-gb-light-bg1 dark:bg-gb-bg1 px-4 py-3">
                <button
                  type="button"
                  on:click={() => cycleColor(tag.id, tag.color)}
                  style="background-color: {$gruvboxColors[tag.color]}"
                  class="w-5 h-5 shrink-0 border-2 border-gb-light-bg3 dark:border-gb-bg3 hover:scale-110 transition-transform"
                  title="Click to change color"
                ></button>
                <span class="flex-1 text-gb-light-fg dark:text-gb-fg text-sm">{tag.name}</span>
                <button
                  type="button"
                  on:click={() => handleDeleteTagClick(tag.id)}
                  aria-label={confirmingTagId === tag.id ? `Confirm delete ${tag.name}` : `Delete ${tag.name}`}
                  class="text-xs font-medium px-2 py-1 transition-colors shrink-0
                         {confirmingTagId === tag.id ? 'text-white bg-gb-light-red dark:bg-gb-red' : 'text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-red dark:hover:text-gb-red'}"
                >{confirmingTagId === tag.id ? 'Confirm?' : '✕'}</button>
              </li>
            {/each}
```

to:

```svelte
            {#each $activeTags as tag (tag.id)}
              <li class="flex flex-col bg-gb-light-bg1 dark:bg-gb-bg1">
                <div class="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    on:click={() => cycleColor(tag.id, tag.color)}
                    style="background-color: {$gruvboxColors[tag.color]}"
                    class="w-5 h-5 shrink-0 border-2 border-gb-light-bg3 dark:border-gb-bg3 hover:scale-110 transition-transform"
                    title="Click to change color"
                  ></button>
                  <span class="flex-1 text-gb-light-fg dark:text-gb-fg text-sm">{tag.name}</span>
                  <button
                    type="button"
                    on:click={() => toggleTagExpand(tag.id)}
                    aria-label="Manage subscription for {tag.name}"
                    aria-expanded={expandedTagId === tag.id}
                    class="text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-blue dark:hover:text-gb-blue transition-colors shrink-0"
                  >{@html icons.calendar}</button>
                  <button
                    type="button"
                    on:click={() => handleDeleteTagClick(tag.id)}
                    aria-label={confirmingTagId === tag.id ? `Confirm delete ${tag.name}` : `Delete ${tag.name}`}
                    class="text-xs font-medium px-2 py-1 transition-colors shrink-0
                           {confirmingTagId === tag.id ? 'text-white bg-gb-light-red dark:bg-gb-red' : 'text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-red dark:hover:text-gb-red'}"
                  >{confirmingTagId === tag.id ? 'Confirm?' : '✕'}</button>
                </div>
                {#if expandedTagId === tag.id}
                  <div transition:slide={{ duration: 200 }}>
                    <SubscriptionPeriods {tag} {userId} />
                  </div>
                {/if}
              </li>
            {/each}
```

- [ ] **Step 6: Run the full test suite and type-check**

Run: `npx vitest run`
Expected: full suite passes (no regressions).

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/settings/SubscriptionPeriods.svelte src/lib/components/settings/SubscriptionPeriods.test.ts src/routes/settings/+page.svelte
git commit -m "feat: add Settings UI for managing subscription periods per training type"
```

---

### Task 3: Calendar corner-ribbon highlight

**Files:**
- Modify: `src/lib/components/calendar/Calendar.svelte`
- Test: `src/lib/components/calendar/Calendar.test.ts`

**Interfaces:**
- Consumes (from Task 1): `getEndingColorsByDate(tags: TrainingTag[]): Record<string, GruvboxColor[]>` from `$lib/domain`.
- Consumes (pre-existing, unchanged): `Calendar.svelte`'s existing `tags: TrainingTag[]` prop already carries `subscriptionPeriods` once Task 1 lands — no prop signature change needed.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/components/calendar/Calendar.test.ts`, in the top-level `describe('Calendar', ...)` block (anywhere after the existing split-legend tests is fine):

```ts
  it("shows a corner ribbon on the cell matching a tag's latest subscription period end date", () => {
    const tagsWithSub: TrainingTag[] = [
      { id: 'tag1', name: 'Boxing', color: 'red', deleted: false, subscriptionPeriods: [{ startDate: '2026-06-01', endDate: '2026-06-15' }] },
    ];
    const { getByText } = render(Calendar, { props: { year: 2026, month: 6, days: {}, tags: tagsWithSub } });
    const day15 = getByText('15', { exact: true }).closest('button');
    const day14 = getByText('14', { exact: true }).closest('button');
    expect(day15?.querySelector('[data-ending-count]')).not.toBeNull();
    expect(day14?.querySelector('[data-ending-count]')).toBeNull();
  });

  it("shows data-ending-count of 2 when two tags' latest periods end on the same day", () => {
    const tagsWithSub: TrainingTag[] = [
      { id: 'tag1', name: 'Boxing', color: 'red', deleted: false, subscriptionPeriods: [{ startDate: '2026-06-01', endDate: '2026-06-15' }] },
      { id: 'tag2', name: 'Weights', color: 'blue', deleted: false, subscriptionPeriods: [{ startDate: '2026-06-02', endDate: '2026-06-15' }] },
    ];
    const { getByText } = render(Calendar, { props: { year: 2026, month: 6, days: {}, tags: tagsWithSub } });
    const day15 = getByText('15', { exact: true }).closest('button');
    expect(day15?.querySelector('[data-ending-count]')?.getAttribute('data-ending-count')).toBe('2');
  });

  it('does not show a ribbon for an ongoing period with no end date', () => {
    const tagsOngoing: TrainingTag[] = [
      { id: 'tag1', name: 'Boxing', color: 'red', deleted: false, subscriptionPeriods: [{ startDate: '2026-06-01' }] },
    ];
    const { container } = render(Calendar, { props: { year: 2026, month: 6, days: {}, tags: tagsOngoing } });
    expect(container.querySelector('[data-ending-count]')).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/components/calendar/Calendar.test.ts`
Expected: the 3 new tests FAIL (`data-ending-count` doesn't exist anywhere yet); all pre-existing tests still PASS.

- [ ] **Step 3: Implement the ribbon**

In `src/lib/components/calendar/Calendar.svelte`, add to the imports:

```ts
  import { gruvboxColors, icons, navColorClasses } from '$lib/theme';
  import { getEndingColorsByDate } from '$lib/domain';
  import type { TrainingTag, Split, DayEntry } from '$lib/types';
```

Add a reactive declaration right after the existing `$: splitMap = ...` line:

```ts
  $: splitMap = Object.fromEntries(splits.map((s) => [s.id, s]));
  $: endingColorsByDate = getEndingColorsByDate(tags);
```

Change the `CellData` type from:

```ts
  type CellData = { null: true } | {
    num: number; colors: string[]; splitColors: string[]; tagIds: string[]; label: string;
    hasNote: boolean; hasPhotos: boolean; isToday: boolean;
  };
```

to:

```ts
  type CellData = { null: true } | {
    num: number; colors: string[]; splitColors: string[]; tagIds: string[]; label: string;
    hasNote: boolean; hasPhotos: boolean; isToday: boolean; endingColors: string[];
  };
```

Change the `cellData` mapping from:

```ts
  $: cellData = gridCells.map((cell): CellData => {
    if (cell === null) return { null: true };
    const entry = days[key(cell)];
    return {
      num: cell,
      colors: (entry?.tags ?? []).map((id) => tagMap[id]).filter(Boolean).map((t) => $gruvboxColors[t.color]),
      splitColors: (entry?.splitIds ?? []).map((id) => splitMap[id]).filter(Boolean).map((s) => $gruvboxColors[s.color ?? 'blue']),
      tagIds: [...(entry?.tags ?? []), ...(entry?.splitIds ?? [])],
      label: entry?.label ?? '',
      hasNote: !!(entry?.note),
      hasPhotos: !!(entry?.photos?.length),
      isToday: key(cell) === todayKey,
    };
  });
```

to:

```ts
  $: cellData = gridCells.map((cell): CellData => {
    if (cell === null) return { null: true };
    const entry = days[key(cell)];
    return {
      num: cell,
      colors: (entry?.tags ?? []).map((id) => tagMap[id]).filter(Boolean).map((t) => $gruvboxColors[t.color]),
      splitColors: (entry?.splitIds ?? []).map((id) => splitMap[id]).filter(Boolean).map((s) => $gruvboxColors[s.color ?? 'blue']),
      tagIds: [...(entry?.tags ?? []), ...(entry?.splitIds ?? [])],
      label: entry?.label ?? '',
      hasNote: !!(entry?.note),
      hasPhotos: !!(entry?.photos?.length),
      isToday: key(cell) === todayKey,
      endingColors: (endingColorsByDate[key(cell)] ?? []).map((c) => $gruvboxColors[c]),
    };
  });
```

In the template, change the day-cell button's class attribute from:

```svelte
              class="hover:bg-gb-light-bg1 dark:hover:bg-gb-bg1 transition min-h-[4.5rem] p-1.5
                     flex flex-col items-start gap-1 text-left
                     {cell.isToday ? 'bg-gb-light-bg1 dark:bg-gb-bg1' : 'bg-gb-light-bg dark:bg-gb-bg'}
                     {selectedTagId && !cell.tagIds.includes(selectedTagId) ? 'opacity-30' : ''}"
```

to:

```svelte
              class="relative hover:bg-gb-light-bg1 dark:hover:bg-gb-bg1 transition min-h-[4.5rem] p-1.5
                     flex flex-col items-start gap-1 text-left
                     {cell.isToday ? 'bg-gb-light-bg1 dark:bg-gb-bg1' : 'bg-gb-light-bg dark:bg-gb-bg'}
                     {selectedTagId && !cell.tagIds.includes(selectedTagId) ? 'opacity-30' : ''}"
```

and add this as the first thing inside the `<button>` (right after the `style={...}` attribute closes, before the day-number `<span>`):

```svelte
              {#if cell.endingColors.length > 0}
                <div class="absolute top-0 right-0 flex pointer-events-none" data-ending-count={cell.endingColors.length}>
                  {#each cell.endingColors as color}
                    <div style="width:0;height:0;border-style:solid;border-width:0 14px 14px 0;border-color:transparent {color} transparent transparent;"></div>
                  {/each}
                </div>
              {/if}
```

- [ ] **Step 4: Run the tests to verify they pass, then run the full suite and type-check**

Run: `npx vitest run src/lib/components/calendar/Calendar.test.ts`
Expected: all tests PASS, including the 3 new ones.

Run: `npx vitest run`
Expected: full suite passes.

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/calendar/Calendar.svelte src/lib/components/calendar/Calendar.test.ts
git commit -m "feat: highlight a training type's subscription end date on the calendar"
```

---

### Task 4: Dismissible reminder banner

**Files:**
- Create: `src/lib/components/calendar/SubscriptionReminders.svelte`
- Test: `src/lib/components/calendar/SubscriptionReminders.test.ts` (new)
- Modify: `src/routes/calendar/+page.svelte`

**Interfaces:**
- Consumes (from Task 1): `getExpiringSoon(tags, now?)` from `$lib/domain`; `updateTagSubscriptionPeriods(userId, tagId, periods)` from `$lib/stores/tags`.
- Consumes (pre-existing): `gruvboxColors` (`$lib/theme`), `showError` (`$lib/stores/toast`).
- Produces: `SubscriptionReminders.svelte` with props `tags: TrainingTag[]`, `userId: string` — no events.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/components/calendar/SubscriptionReminders.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SubscriptionReminders from './SubscriptionReminders.svelte';
import type { TrainingTag } from '$lib/types';

const mockUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/stores/tags', () => ({
  updateTagSubscriptionPeriods: (...args: unknown[]) => mockUpdate(...args),
}));
vi.mock('$lib/stores/theme', () => ({
  theme: { subscribe: (cb: (v: 'dark' | 'light') => void) => { cb('dark'); return () => {}; } }
}));

function tag(overrides: Partial<TrainingTag> = {}): TrainingTag {
  return { id: 'tag1', name: 'Boxing', color: 'red', deleted: false, ...overrides };
}

describe('SubscriptionReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-07T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a banner for a tag expiring within 5 days', () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-10' }] })];
    const { getByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(getByText('Boxing ends in 3 days')).toBeInTheDocument();
  });

  it('does not render a banner for a tag with 5 or more days remaining', () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-12' }] })];
    const { queryByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(queryByText(/Boxing/)).not.toBeInTheDocument();
  });

  it('does not render a banner for an ongoing period with no end date', () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-07-01' }] })];
    const { queryByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(queryByText(/Boxing/)).not.toBeInTheDocument();
  });

  it('shows "ends today" for a period ending today', () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-07' }] })];
    const { getByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(getByText('Boxing ends today')).toBeInTheDocument();
  });

  it('shows "ended N days ago" for an already-expired period', () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-06-01', endDate: '2026-07-05' }] })];
    const { getByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(getByText('Boxing ended 2 days ago')).toBeInTheDocument();
  });

  it('shows the period note in parentheses when present', () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-10', note: "Gold's Gym, $50/mo" }] })];
    const { getByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(getByText("(Gold's Gym, $50/mo)")).toBeInTheDocument();
  });

  it('renders one banner per expiring tag when multiple are expiring', () => {
    const tags = [
      tag({ id: 'tag1', name: 'Boxing', subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-10' }] }),
      tag({ id: 'tag2', name: 'Weights', color: 'blue', subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-09' }] }),
    ];
    const { getByText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    expect(getByText('Boxing ends in 3 days')).toBeInTheDocument();
    expect(getByText('Weights ends in 2 days')).toBeInTheDocument();
  });

  it('clicking Dismiss calls the store with dismissed: true on that period', async () => {
    const tags = [tag({ subscriptionPeriods: [{ startDate: '2026-07-01', endDate: '2026-07-10' }] })];
    const { getByLabelText } = render(SubscriptionReminders, { props: { tags, userId: 'user1' } });
    await fireEvent.click(getByLabelText('Dismiss Boxing reminder'));
    expect(mockUpdate).toHaveBeenCalledWith('user1', 'tag1', [
      { startDate: '2026-07-01', endDate: '2026-07-10', dismissed: true },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/components/calendar/SubscriptionReminders.test.ts`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/calendar/SubscriptionReminders.svelte`:

```svelte
<script lang="ts">
  import { getExpiringSoon } from '$lib/domain';
  import { updateTagSubscriptionPeriods } from '$lib/stores/tags';
  import { showError } from '$lib/stores/toast';
  import { gruvboxColors } from '$lib/theme';
  import type { TrainingTag, SubscriptionPeriod } from '$lib/types';

  export let tags: TrainingTag[] = [];
  export let userId: string;

  $: expiring = getExpiringSoon(tags);

  function message(daysRemaining: number, name: string): string {
    if (daysRemaining > 0) return `${name} ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
    if (daysRemaining === 0) return `${name} ends today`;
    const daysAgo = -daysRemaining;
    return `${name} ended ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
  }

  function dismiss(tag: TrainingTag, period: SubscriptionPeriod) {
    const periods = (tag.subscriptionPeriods ?? []).map((p) =>
      p === period ? { ...p, dismissed: true } : p
    );
    updateTagSubscriptionPeriods(userId, tag.id, periods).catch(() => showError());
  }
</script>

{#if expiring.length > 0}
  <div class="flex flex-col gap-2">
    {#each expiring as { tag, period, daysRemaining } (tag.id)}
      <div
        class="flex items-center gap-3 px-4 py-3 border-l-4 bg-gb-light-bg1 dark:bg-gb-bg1 text-sm"
        style="border-color: {$gruvboxColors[tag.color]}"
      >
        <span class="flex-1 text-gb-light-fg dark:text-gb-fg">
          {message(daysRemaining, tag.name)}
          {#if period.note}
            <span class="text-gb-light-fg3 dark:text-gb-fg3"> ({period.note})</span>
          {/if}
        </span>
        <button
          type="button"
          on:click={() => dismiss(tag, period)}
          aria-label="Dismiss {tag.name} reminder"
          class="text-xs font-medium text-gb-light-fg3 dark:text-gb-fg3 hover:text-gb-light-red dark:hover:text-gb-red transition-colors shrink-0"
        >Dismiss</button>
      </div>
    {/each}
  </div>
{/if}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/components/calendar/SubscriptionReminders.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Wire it into the calendar page**

In `src/routes/calendar/+page.svelte`, add the import:

```ts
  import Calendar from '$lib/components/calendar/Calendar.svelte';
  import SubscriptionReminders from '$lib/components/calendar/SubscriptionReminders.svelte';
```

Add it above `<Calendar ... />`:

```svelte
  {#if $tagsLoading || $daysLoading}
    <Spinner />
  {:else}
    <SubscriptionReminders tags={$tags} {userId} />
    <Calendar
```

- [ ] **Step 6: Run the full test suite and type-check**

Run: `npx vitest run`
Expected: full suite passes (no regressions).

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/calendar/SubscriptionReminders.svelte src/lib/components/calendar/SubscriptionReminders.test.ts src/routes/calendar/+page.svelte
git commit -m "feat: show a dismissible reminder banner for subscriptions ending soon"
```
