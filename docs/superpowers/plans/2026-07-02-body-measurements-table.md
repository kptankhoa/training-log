# Body Measurements Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tape-measure body-measurements table (chest/waist/hip/limbs) as a new "Measurements" pill on the Stats page, and split the Stats page's three sections (Metrics, Measurements, Photos) into independent, self-contained components.

**Architecture:** `stats/+page.svelte` becomes a thin shell owning only `userId` and the top-level pill row. Each section is its own component that manages its own Firestore subscription: `MetricsChart.svelte` (relocated, unchanged behavior) and `MeasurementsTable.svelte` (new) each call their own `init*` function in `onMount`; `PhotoTimeline.svelte` (untouched) stays prop-driven off the shared `$allDays` store. All three components stay mounted simultaneously — the page toggles which one is *visible* via a `hidden` class, not `{#if}` — so switching pills back and forth does not tear down and re-create Firestore listeners.

**Tech Stack:** SvelteKit (Svelte 5 legacy component syntax — `export let`, `on:click`, `$:`), Firebase Firestore, Tailwind CSS (Gruvbox Dark palette), Chart.js (via existing `LineChart.svelte`), Vitest + @testing-library/svelte.

## Global Constraints

- New Firestore collection path: `users/{userId}/measurements/{YYYY-MM-DD}` (reuses the name freed up by the earlier Metrics rename; old backup docs at that path have already been cleared by the user).
- Every measurement field is optional. A field the user didn't enter must be **absent from the Firestore doc** — never written as `0` or `null` — so the table can render it as `—`.
- Units: kg for weight, cm for every circumference field. No unit conversion/toggle.
- No chart for this feature — table only.
- Delete is immediate on click, no confirm step (matches the existing Metrics entries list, not the confirm-to-delete pattern used for photos/exercises).
- No in-place editing of a past entry's individual fields — re-adding the same date via the form merges in whatever fields were filled, via `{ merge: true }`.
- `weight` in this new table is fully independent from Metrics' `weight` — no cross-referencing.
- Column order (fixed): `Date | Weight | Chest | Waist | Handles | Hip | Arm L | Forearm L | Arm R | Forearm R | Thigh L | Thigh R | Calf L | Calf R`.
- Run `npx vitest run` and `npm run check` after every task; both must be clean before moving on.

---

### Task 1: `BodyMeasurementEntry` type + `bodyMeasurements` store

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/stores/bodyMeasurements.ts`
- Test: `src/lib/stores/bodyMeasurements.test.ts`

**Interfaces:**
- Produces: `BodyMeasurementEntry` type; `bodyMeasurements` (Readable store), `bodyMeasurementsLoading` (Readable store), `initBodyMeasurements(userId: string): () => void`, `saveBodyMeasurement(userId: string, dateKey: string, data: Partial<Omit<BodyMeasurementEntry, 'id'>>): Promise<void>`, `deleteBodyMeasurement(userId: string, dateKey: string): Promise<void>` — all consumed by Task 3's `MeasurementsTable.svelte`.

- [ ] **Step 1: Add the type to `src/lib/types.ts`**

Append to the end of the file (after the existing `BodyMeasurement` interface):

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

- [ ] **Step 2: Write the failing store test**

Create `src/lib/stores/bodyMeasurements.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockCollection = vi.fn(() => ({}));
const mockDoc = vi.fn(() => ({}));

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
}));

describe('bodyMeasurements store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty array', async () => {
    const { bodyMeasurements } = await import('./bodyMeasurements');
    expect(get(bodyMeasurements)).toEqual([]);
  });

  it('initBodyMeasurements populates store sorted by date key ascending', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({
        docs: [
          { id: '2026-01-01', data: () => ({ chest: 100, waist: 80 }) },
          { id: '2023-11-26', data: () => ({ chest: 95 }) },
        ],
      });
      return () => {};
    });
    const { bodyMeasurements, initBodyMeasurements } = await import('./bodyMeasurements');
    initBodyMeasurements('user1');
    const result = get(bodyMeasurements);
    expect(result.map((r) => r.id)).toEqual(['2023-11-26', '2026-01-01']);
  });

  it('keeps only the fields present in the Firestore doc (no defaulting to 0)', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ docs: [{ id: '2026-06-10', data: () => ({ chest: 100 }) }] });
      return () => {};
    });
    const { bodyMeasurements, initBodyMeasurements } = await import('./bodyMeasurements');
    initBodyMeasurements('user1');
    const [entry] = get(bodyMeasurements);
    expect(entry).toEqual({ id: '2026-06-10', chest: 100 });
    expect(entry.waist).toBeUndefined();
  });

  it('saveBodyMeasurement calls setDoc with the partial payload and merge:true', async () => {
    const { saveBodyMeasurement } = await import('./bodyMeasurements');
    await saveBodyMeasurement('user1', '2026-06-23', { chest: 101, waist: 82 });
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { chest: 101, waist: 82 }, { merge: true });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'measurements', '2026-06-23');
  });

  it('deleteBodyMeasurement calls deleteDoc with correct ref', async () => {
    const { deleteBodyMeasurement } = await import('./bodyMeasurements');
    await deleteBodyMeasurement('user1', '2026-06-23');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'measurements', '2026-06-23');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/stores/bodyMeasurements.test.ts`
Expected: FAIL — `Cannot find module './bodyMeasurements'` (file doesn't exist yet).

- [ ] **Step 4: Implement the store**

Create `src/lib/stores/bodyMeasurements.ts`:

```ts
import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { BodyMeasurementEntry } from '$lib/types';

const _bodyMeasurements = writable<BodyMeasurementEntry[]>([]);
const _bodyMeasurementsLoading = writable<boolean>(true);
export const bodyMeasurements = { subscribe: _bodyMeasurements.subscribe };
export const bodyMeasurementsLoading = { subscribe: _bodyMeasurementsLoading.subscribe };

export function initBodyMeasurements(userId: string): () => void {
  _bodyMeasurementsLoading.set(true);
  return onSnapshot(collection(db, 'users', userId, 'measurements'), (snap) => {
    const loaded = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BodyMeasurementEntry, 'id'>) }));
    loaded.sort((a, b) => a.id.localeCompare(b.id));
    _bodyMeasurements.set(loaded);
    _bodyMeasurementsLoading.set(false);
  });
}

export async function saveBodyMeasurement(
  userId: string,
  dateKey: string,
  data: Partial<Omit<BodyMeasurementEntry, 'id'>>
): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'measurements', dateKey), data, { merge: true });
}

export async function deleteBodyMeasurement(userId: string, dateKey: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'measurements', dateKey));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/stores/bodyMeasurements.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/stores/bodyMeasurements.ts src/lib/stores/bodyMeasurements.test.ts
git commit -m "feat: add bodyMeasurements store for the new Measurements table"
```

---

### Task 2: Extract `MetricsChart.svelte` from the Stats page

This is a pure relocation of the existing weight/muscle/fat/BFP/score chart logic out of `stats/+page.svelte` — no behavior changes. It reads the current `src/routes/stats/+page.svelte` (lines 1-79 script, and the metric-tabs/chart/entries-list/add-entry markup) and lifts it into its own component.

**Files:**
- Create: `src/lib/components/MetricsChart.svelte`
- Test: `src/lib/components/MetricsChart.test.ts`
- Modify (later, in Task 4): `src/routes/stats/+page.svelte`

**Interfaces:**
- Consumes: `measurements`, `measurementsLoading`, `initMeasurements`, `saveMeasurement`, `deleteMeasurement` from `$lib/stores/measurements` (all pre-existing, unchanged); `LineChart.svelte`, `Spinner.svelte` (pre-existing, unchanged); `BodyMeasurement` type from `$lib/types` (pre-existing).
- Produces: `MetricsChart.svelte` taking a single prop `userId: string`, used by Task 4's `stats/+page.svelte`.

- [ ] **Step 1: Write the failing component test**

Create `src/lib/components/MetricsChart.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MetricsChart from './MetricsChart.svelte';
import type { BodyMeasurement } from '$lib/types';

let measurementsValue: BodyMeasurement[] = [];
let measurementsLoadingValue = false;
const mockInitMeasurements = vi.fn();
const mockSaveMeasurement = vi.fn().mockResolvedValue(undefined);
const mockDeleteMeasurement = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/stores/measurements', () => ({
  measurements: {
    subscribe: (cb: (v: BodyMeasurement[]) => void) => { cb(measurementsValue); return () => {}; }
  },
  measurementsLoading: {
    subscribe: (cb: (v: boolean) => void) => { cb(measurementsLoadingValue); return () => {}; }
  },
  initMeasurements: mockInitMeasurements,
  saveMeasurement: mockSaveMeasurement,
  deleteMeasurement: mockDeleteMeasurement,
}));

vi.mock('chart.js', () => {
  class MockChart {
    static register() {}
    destroy() {}
  }
  return {
    Chart: MockChart,
    LineController: {}, LineElement: {}, PointElement: {}, LinearScale: {},
    CategoryScale: {}, Tooltip: {}, Legend: {}, Filler: {},
  };
});

describe('MetricsChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    measurementsValue = [];
    measurementsLoadingValue = false;
  });

  it('calls initMeasurements with the given userId on mount', () => {
    render(MetricsChart, { props: { userId: 'user1' } });
    expect(mockInitMeasurements).toHaveBeenCalledWith('user1');
  });

  it('shows a spinner while loading', () => {
    measurementsLoadingValue = true;
    const { container } = render(MetricsChart, { props: { userId: 'user1' } });
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows an empty state when there are no entries', () => {
    const { getByText } = render(MetricsChart, { props: { userId: 'user1' } });
    expect(getByText('No measurements yet')).toBeInTheDocument();
  });

  it('renders the entries list newest first', () => {
    measurementsValue = [
      { id: '2026-01-01', weight: 80, muscleMass: 36, fatMass: 16, bfp: 20, score: 80 },
      { id: '2026-02-01', weight: 79, muscleMass: 36, fatMass: 15, bfp: 19, score: 82 },
    ];
    const { getAllByText } = render(MetricsChart, { props: { userId: 'user1' } });
    const rows = getAllByText(/kg MM/);
    expect(rows[0].textContent).toContain('79kg');
  });

  it('deleting an entry calls deleteMeasurement with its id', async () => {
    measurementsValue = [{ id: '2026-01-01', weight: 80, muscleMass: 36, fatMass: 16, bfp: 20, score: 80 }];
    const { getByLabelText } = render(MetricsChart, { props: { userId: 'user1' } });
    await fireEvent.click(getByLabelText('Delete entry for 2026-01-01'));
    expect(mockDeleteMeasurement).toHaveBeenCalledWith('user1', '2026-01-01');
  });

  it('adding an entry calls saveMeasurement with the form values', async () => {
    const { getByText, getByLabelText } = render(MetricsChart, { props: { userId: 'user1' } });
    await fireEvent.click(getByText('+ Add entry'));
    await fireEvent.input(getByLabelText('Weight (kg)'), { target: { value: '80.5' } });
    await fireEvent.click(getByText('Save entry'));
    expect(mockSaveMeasurement).toHaveBeenCalledWith(
      'user1',
      expect.any(String),
      expect.objectContaining({ weight: 80.5 })
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/MetricsChart.test.ts`
Expected: FAIL — `Failed to resolve import "./MetricsChart.svelte"` (component doesn't exist yet).

- [ ] **Step 3: Create the component**

Create `src/lib/components/MetricsChart.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { measurements, measurementsLoading, initMeasurements, saveMeasurement, deleteMeasurement } from '$lib/stores/measurements';
  import LineChart from './LineChart.svelte';
  import Spinner from './Spinner.svelte';
  import type { BodyMeasurement } from '$lib/types';

  export let userId: string;

  onMount(() => {
    if (!userId) return;
    return initMeasurements(userId);
  });

  type MetricKey = 'weight' | 'muscleMass' | 'fatMass' | 'bfp' | 'score';
  const metrics: { key: MetricKey; label: string; unit: string; color: string }[] = [
    { key: 'weight',     label: 'Weight',      unit: ' kg', color: '#83a598' },
    { key: 'muscleMass', label: 'Muscle Mass', unit: ' kg', color: '#b8bb26' },
    { key: 'fatMass',    label: 'Fat Mass',    unit: ' kg', color: '#fe8019' },
    { key: 'bfp',        label: 'Body Fat %',  unit: '%',   color: '#fb4934' },
    { key: 'score',      label: 'Score',       unit: '',    color: '#d3869b' },
  ];

  type MetricTabKey = MetricKey | 'all';
  let activeMetric: MetricTabKey = 'all';
  $: activeMetricInfo = metrics.find((m) => m.key === activeMetric);

  function formatLabel(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  $: chartLabels = $measurements.map((e) => formatLabel(e.id));
  $: chartData = activeMetricInfo ? $measurements.map((e) => e[activeMetricInfo.key]) : [];
  $: chartSeries = activeMetric === 'all'
    ? metrics.map((m) => ({ label: m.label, data: $measurements.map((e) => e[m.key]), color: m.color, unit: m.unit }))
    : null;

  // Add entry form
  let showAddForm = false;
  let draftDate = new Date().toISOString().slice(0, 10);
  let draftWeight = '';
  let draftMuscleMass = '';
  let draftFatMass = '';
  let draftBfp = '';
  let draftScore = '';

  function resetDraft() {
    draftDate = new Date().toISOString().slice(0, 10);
    draftWeight = draftMuscleMass = draftFatMass = draftBfp = draftScore = '';
  }

  async function handleAddEntry() {
    if (!userId || !draftDate) return;
    const data: Omit<BodyMeasurement, 'id'> = {
      weight: Number(draftWeight) || 0,
      muscleMass: Number(draftMuscleMass) || 0,
      fatMass: Number(draftFatMass) || 0,
      bfp: Number(draftBfp) || 0,
      score: Number(draftScore) || 0,
    };
    await saveMeasurement(userId, draftDate, data);
    resetDraft();
    showAddForm = false;
  }

  async function handleDelete(id: string) {
    if (!userId) return;
    await deleteMeasurement(userId, id);
  }
</script>

<div class="flex flex-col gap-6">
  <!-- Metric tabs -->
  <div class="flex gap-2 overflow-x-auto pb-1">
    <button
      type="button"
      on:click={() => (activeMetric = 'all')}
      class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
             {activeMetric === 'all' ? 'border-gb-green text-gb-green bg-gb-bg1' : 'border-gb-bg3 text-gb-fg2 hover:bg-gb-bg1'}"
    >
      All
    </button>
    {#each metrics as m (m.key)}
      <button
        type="button"
        on:click={() => (activeMetric = m.key)}
        class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
               {activeMetric === m.key ? 'border-gb-green text-gb-green bg-gb-bg1' : 'border-gb-bg3 text-gb-fg2 hover:bg-gb-bg1'}"
      >
        {m.label}
      </button>
    {/each}
  </div>

  {#if $measurementsLoading}
    <Spinner />
  {:else if $measurements.length === 0}
    <div class="bg-gb-bg1 rounded-xl p-10 text-center flex flex-col gap-2">
      <p class="text-gb-fg3 text-lg">No measurements yet</p>
      <p class="text-gb-gray text-sm">Add an entry below to start tracking.</p>
    </div>
  {:else}
    <div class="bg-gb-bg1 rounded-xl p-4">
      {#if chartSeries}
        <LineChart labels={chartLabels} series={chartSeries} />
      {:else if activeMetricInfo}
        <LineChart labels={chartLabels} data={chartData} color={activeMetricInfo.color} unit={activeMetricInfo.unit} />
      {/if}
    </div>

    <!-- Entries list -->
    <section class="flex flex-col gap-2">
      <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2 text-sm uppercase tracking-wider">Entries</h2>
      <div class="flex flex-col gap-1">
        {#each [...$measurements].reverse() as entry (entry.id)}
          <div class="flex items-center gap-3 bg-gb-bg1 px-3 py-2 text-sm">
            <span class="text-gb-fg3 w-24 shrink-0">{formatLabel(entry.id)}</span>
            <span class="flex-1 text-gb-fg truncate">
              {entry.weight}kg · {entry.muscleMass}kg MM · {entry.fatMass}kg FM · {entry.bfp}% BF · {entry.score} score
            </span>
            <button
              type="button"
              on:click={() => handleDelete(entry.id)}
              aria-label="Delete entry for {entry.id}"
              class="text-gb-fg3 hover:text-gb-red transition-colors shrink-0"
            >✕</button>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Add entry -->
  <section class="flex flex-col gap-3">
    <button
      type="button"
      on:click={() => (showAddForm = !showAddForm)}
      class="text-sm text-gb-blue hover:text-gb-fg transition self-start"
    >
      {showAddForm ? '− Cancel' : '+ Add entry'}
    </button>

    {#if showAddForm}
      <div class="bg-gb-bg1 p-4 flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label for="m-date" class="text-xs text-gb-fg3 uppercase tracking-wider">Date</label>
          <input id="m-date" type="date" lang="en-GB" bind:value={draftDate}
            class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label for="m-weight" class="text-xs text-gb-fg3 uppercase tracking-wider">Weight (kg)</label>
            <input id="m-weight" type="number" step="0.1" bind:value={draftWeight}
              class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="m-muscle" class="text-xs text-gb-fg3 uppercase tracking-wider">Muscle Mass (kg)</label>
            <input id="m-muscle" type="number" step="0.1" bind:value={draftMuscleMass}
              class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="m-fat" class="text-xs text-gb-fg3 uppercase tracking-wider">Fat Mass (kg)</label>
            <input id="m-fat" type="number" step="0.1" bind:value={draftFatMass}
              class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="m-bfp" class="text-xs text-gb-fg3 uppercase tracking-wider">Body Fat %</label>
            <input id="m-bfp" type="number" step="0.1" bind:value={draftBfp}
              class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
          </div>
          <div class="flex flex-col gap-1">
            <label for="m-score" class="text-xs text-gb-fg3 uppercase tracking-wider">Score</label>
            <input id="m-score" type="number" step="1" bind:value={draftScore}
              class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
          </div>
        </div>
        <button
          type="button"
          on:click={handleAddEntry}
          class="bg-gb-green text-gb-bg font-semibold px-4 py-2 text-sm hover:opacity-90 transition self-start"
        >Save entry</button>
      </div>
    {/if}
  </section>
</div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/MetricsChart.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/MetricsChart.svelte src/lib/components/MetricsChart.test.ts
git commit -m "feat: extract MetricsChart component from the Stats page"
```

(Note: `stats/+page.svelte` still has the old inline code at this point — it gets rewired in Task 4. Both the old inline version and the new `MetricsChart.svelte` coexist harmlessly until then.)

---

### Task 3: `MeasurementsTable.svelte` (the new feature)

**Files:**
- Create: `src/lib/components/MeasurementsTable.svelte`
- Test: `src/lib/components/MeasurementsTable.test.ts`

**Interfaces:**
- Consumes: `bodyMeasurements`, `bodyMeasurementsLoading`, `initBodyMeasurements`, `saveBodyMeasurement`, `deleteBodyMeasurement` from `$lib/stores/bodyMeasurements` (Task 1); `Spinner.svelte` (pre-existing); `BodyMeasurementEntry` type (Task 1).
- Produces: `MeasurementsTable.svelte` taking a single prop `userId: string`, used by Task 4's `stats/+page.svelte`.

- [ ] **Step 1: Write the failing component test**

Create `src/lib/components/MeasurementsTable.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MeasurementsTable from './MeasurementsTable.svelte';
import type { BodyMeasurementEntry } from '$lib/types';

let entriesValue: BodyMeasurementEntry[] = [];
let loadingValue = false;
const mockInit = vi.fn();
const mockSave = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/stores/bodyMeasurements', () => ({
  bodyMeasurements: {
    subscribe: (cb: (v: BodyMeasurementEntry[]) => void) => { cb(entriesValue); return () => {}; }
  },
  bodyMeasurementsLoading: {
    subscribe: (cb: (v: boolean) => void) => { cb(loadingValue); return () => {}; }
  },
  initBodyMeasurements: mockInit,
  saveBodyMeasurement: mockSave,
  deleteBodyMeasurement: mockDelete,
}));

describe('MeasurementsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entriesValue = [];
    loadingValue = false;
  });

  it('calls initBodyMeasurements with the given userId on mount', () => {
    render(MeasurementsTable, { props: { userId: 'user1' } });
    expect(mockInit).toHaveBeenCalledWith('user1');
  });

  it('shows an empty state when there are no entries', () => {
    const { getByText } = render(MeasurementsTable, { props: { userId: 'user1' } });
    expect(getByText('No measurements yet')).toBeInTheDocument();
  });

  it('renders a dash for fields that were not entered, and the raw value for ones that were', () => {
    entriesValue = [{ id: '2026-06-10', chest: 100 }];
    const { getAllByText } = render(MeasurementsTable, { props: { userId: 'user1' } });
    expect(getAllByText('—').length).toBeGreaterThan(0);
    expect(getAllByText('100').length).toBeGreaterThan(0);
  });

  it('deleting a row calls deleteBodyMeasurement with its id, immediately (no confirm)', async () => {
    entriesValue = [{ id: '2026-06-10', chest: 100 }];
    const { getByLabelText } = render(MeasurementsTable, { props: { userId: 'user1' } });
    await fireEvent.click(getByLabelText('Delete entry for 2026-06-10'));
    expect(mockDelete).toHaveBeenCalledWith('user1', '2026-06-10');
  });

  it('adding an entry only includes the fields that were filled in', async () => {
    const { getByText, getByLabelText } = render(MeasurementsTable, { props: { userId: 'user1' } });
    await fireEvent.click(getByText('+ Add entry'));
    await fireEvent.input(getByLabelText('Chest (cm)'), { target: { value: '101' } });
    await fireEvent.input(getByLabelText('Waist (cm)'), { target: { value: '82' } });
    await fireEvent.click(getByText('Save entry'));
    expect(mockSave).toHaveBeenCalledWith('user1', expect.any(String), { chest: 101, waist: 82 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/MeasurementsTable.test.ts`
Expected: FAIL — `Failed to resolve import "./MeasurementsTable.svelte"` (component doesn't exist yet).

- [ ] **Step 3: Create the component**

Create `src/lib/components/MeasurementsTable.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    bodyMeasurements,
    bodyMeasurementsLoading,
    initBodyMeasurements,
    saveBodyMeasurement,
    deleteBodyMeasurement,
  } from '$lib/stores/bodyMeasurements';
  import Spinner from './Spinner.svelte';
  import type { BodyMeasurementEntry } from '$lib/types';

  export let userId: string;

  onMount(() => {
    if (!userId) return;
    return initBodyMeasurements(userId);
  });

  type FieldKey = Exclude<keyof BodyMeasurementEntry, 'id'>;
  const columns: { key: FieldKey; label: string; unit: string }[] = [
    { key: 'weight',    label: 'Weight',    unit: 'kg' },
    { key: 'chest',     label: 'Chest',     unit: 'cm' },
    { key: 'waist',     label: 'Waist',     unit: 'cm' },
    { key: 'handles',   label: 'Handles',   unit: 'cm' },
    { key: 'hip',       label: 'Hip',       unit: 'cm' },
    { key: 'armL',      label: 'Arm L',     unit: 'cm' },
    { key: 'forearmL',  label: 'Forearm L', unit: 'cm' },
    { key: 'armR',      label: 'Arm R',     unit: 'cm' },
    { key: 'forearmR',  label: 'Forearm R', unit: 'cm' },
    { key: 'thighL',    label: 'Thigh L',   unit: 'cm' },
    { key: 'thighR',    label: 'Thigh R',   unit: 'cm' },
    { key: 'calfL',     label: 'Calf L',    unit: 'cm' },
    { key: 'calfR',     label: 'Calf R',    unit: 'cm' },
  ];

  function formatLabel(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  }

  function fmt(value: number | undefined): string {
    return value === undefined ? '—' : String(value);
  }

  async function handleDelete(id: string) {
    if (!userId) return;
    await deleteBodyMeasurement(userId, id);
  }

  // Add entry form
  let showAddForm = false;
  let draftDate = new Date().toISOString().slice(0, 10);
  let draftValues: Record<FieldKey, string> = {
    weight: '', chest: '', waist: '', handles: '', hip: '',
    armL: '', forearmL: '', armR: '', forearmR: '',
    thighL: '', thighR: '', calfL: '', calfR: '',
  };

  function resetDraft() {
    draftDate = new Date().toISOString().slice(0, 10);
    for (const key of Object.keys(draftValues) as FieldKey[]) draftValues[key] = '';
    draftValues = draftValues;
  }

  async function handleAddEntry() {
    if (!userId || !draftDate) return;
    const data: Partial<Omit<BodyMeasurementEntry, 'id'>> = {};
    for (const key of Object.keys(draftValues) as FieldKey[]) {
      const raw = draftValues[key].trim();
      if (raw !== '') data[key] = Number(raw);
    }
    await saveBodyMeasurement(userId, draftDate, data);
    resetDraft();
    showAddForm = false;
  }
</script>

<div class="flex flex-col gap-6">
  {#if $bodyMeasurementsLoading}
    <Spinner />
  {:else if $bodyMeasurements.length === 0}
    <div class="bg-gb-bg1 rounded-xl p-10 text-center flex flex-col gap-2">
      <p class="text-gb-fg3 text-lg">No measurements yet</p>
      <p class="text-gb-gray text-sm">Add an entry below to start tracking.</p>
    </div>
  {:else}
    <div class="overflow-x-auto bg-gb-bg1 rounded-xl">
      <table class="text-sm border-collapse">
        <thead>
          <tr>
            <th class="sticky left-0 bg-gb-bg1 text-left px-3 py-2 text-gb-fg3 uppercase tracking-wider text-xs whitespace-nowrap">Date</th>
            {#each columns as col (col.key)}
              <th class="text-left px-3 py-2 text-gb-fg3 uppercase tracking-wider text-xs whitespace-nowrap">{col.label}</th>
            {/each}
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each [...$bodyMeasurements].reverse() as entry (entry.id)}
            <tr class="border-t border-gb-bg2">
              <td class="sticky left-0 bg-gb-bg1 px-3 py-2 text-gb-fg3 whitespace-nowrap">{formatLabel(entry.id)}</td>
              {#each columns as col (col.key)}
                <td class="px-3 py-2 text-gb-fg whitespace-nowrap">{fmt(entry[col.key])}</td>
              {/each}
              <td class="px-3 py-2">
                <button
                  type="button"
                  on:click={() => handleDelete(entry.id)}
                  aria-label="Delete entry for {entry.id}"
                  class="text-gb-fg3 hover:text-gb-red transition-colors"
                >✕</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Add entry -->
  <section class="flex flex-col gap-3">
    <button
      type="button"
      on:click={() => (showAddForm = !showAddForm)}
      class="text-sm text-gb-blue hover:text-gb-fg transition self-start"
    >
      {showAddForm ? '− Cancel' : '+ Add entry'}
    </button>

    {#if showAddForm}
      <div class="bg-gb-bg1 p-4 flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label for="bm-date" class="text-xs text-gb-fg3 uppercase tracking-wider">Date</label>
          <input id="bm-date" type="date" lang="en-GB" bind:value={draftDate}
            class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {#each columns as col (col.key)}
            <div class="flex flex-col gap-1">
              <label for="bm-{col.key}" class="text-xs text-gb-fg3 uppercase tracking-wider">{col.label} ({col.unit})</label>
              <input id="bm-{col.key}" type="number" step="0.1" bind:value={draftValues[col.key]}
                class="bg-gb-bg2 text-gb-fg text-sm px-3 py-2 border border-gb-bg3 focus:outline-none focus:border-gb-blue" />
            </div>
          {/each}
        </div>
        <button
          type="button"
          on:click={handleAddEntry}
          class="bg-gb-green text-gb-bg font-semibold px-4 py-2 text-sm hover:opacity-90 transition self-start"
        >Save entry</button>
      </div>
    {/if}
  </section>
</div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/MeasurementsTable.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/MeasurementsTable.svelte src/lib/components/MeasurementsTable.test.ts
git commit -m "feat: add MeasurementsTable component for body measurements"
```

---

### Task 4: Rewire `stats/+page.svelte` as a thin pill-switch shell

**Files:**
- Modify: `src/routes/stats/+page.svelte` (full rewrite — replaces lines 1-221 entirely)

**Interfaces:**
- Consumes: `MetricsChart.svelte` (Task 2), `MeasurementsTable.svelte` (Task 3), `PhotoTimeline.svelte` (pre-existing, unchanged), `allDays` from `$lib/stores/days` (pre-existing), `user` from `$lib/stores/auth` (pre-existing).

Important: all three section components must stay **mounted** the whole time the Stats page is open — only their visibility toggles when switching pills. Use a `hidden` class, not `{#if}/{:else if}`, so `MetricsChart` and `MeasurementsTable` each subscribe to Firestore exactly once per page visit instead of re-subscribing every time you switch pills (this mirrors the app-wide principle established for the layout's shared stores — see `src/routes/+layout.svelte`).

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/routes/stats/+page.svelte` with:

```svelte
<script lang="ts">
  import { user } from '$lib/stores/auth';
  import { allDays } from '$lib/stores/days';
  import MetricsChart from '$lib/components/MetricsChart.svelte';
  import MeasurementsTable from '$lib/components/MeasurementsTable.svelte';
  import PhotoTimeline from '$lib/components/PhotoTimeline.svelte';

  $: userId = $user?.uid ?? '';

  type Section = 'metrics' | 'measurements' | 'photos';
  let activeSection: Section = 'metrics';
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
  <h1 class="text-gb-green text-2xl font-bold glow-green">Stats</h1>

  <!-- Section tabs -->
  <div class="flex gap-2">
    <button
      type="button"
      on:click={() => (activeSection = 'metrics')}
      class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
             {activeSection === 'metrics' ? 'border-gb-green text-gb-green bg-gb-bg1' : 'border-gb-bg3 text-gb-fg2 hover:bg-gb-bg1'}"
    >
      Metrics
    </button>
    <button
      type="button"
      on:click={() => (activeSection = 'measurements')}
      class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
             {activeSection === 'measurements' ? 'border-gb-green text-gb-green bg-gb-bg1' : 'border-gb-bg3 text-gb-fg2 hover:bg-gb-bg1'}"
    >
      Measurements
    </button>
    <button
      type="button"
      on:click={() => (activeSection = 'photos')}
      class="px-3 py-1.5 text-sm whitespace-nowrap border transition shrink-0
             {activeSection === 'photos' ? 'border-gb-green text-gb-green bg-gb-bg1' : 'border-gb-bg3 text-gb-fg2 hover:bg-gb-bg1'}"
    >
      Photos
    </button>
  </div>

  <div class:hidden={activeSection !== 'metrics'}>
    <MetricsChart {userId} />
  </div>
  <div class:hidden={activeSection !== 'measurements'}>
    <MeasurementsTable {userId} />
  </div>
  <div class:hidden={activeSection !== 'photos'}>
    <PhotoTimeline days={$allDays} />
  </div>
</div>
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (no test file targets `stats/+page.svelte` directly, so this just confirms nothing else broke).

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, open the Stats page while signed in, and check:
- All three pills (Metrics, Measurements, Photos) switch correctly.
- Switching pills back and forth doesn't cause visible re-loading/flicker in Metrics or Measurements (confirms they're not re-subscribing).
- On Measurements: add an entry with only some fields filled in, confirm the table shows `—` for the untouched ones.
- On a narrow/mobile viewport, confirm the Measurements table scrolls horizontally with the Date column staying pinned on the left.
- Delete a row and confirm it disappears immediately with no confirmation prompt.

- [ ] **Step 5: Commit**

```bash
git add src/routes/stats/+page.svelte
git commit -m "refactor: rewire Stats page as a thin shell over Metrics/Measurements/Photos"
```
