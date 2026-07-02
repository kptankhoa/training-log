## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: none

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A personal training log — a mobile-first SvelteKit SPA for tracking workouts, body metrics/measurements, and progress photos on a calendar. Single-user per account; every Firestore/Storage path is scoped under `users/{userId}`.

## Stack

- **SvelteKit 2** (adapter-cloudflare, `ssr = false` / `prerender = false` in `src/routes/+layout.ts` — this is a pure client-side SPA)
- **Svelte 5 legacy component syntax** everywhere (`export let`, `on:click`, `$:` reactive statements, `createEventDispatcher`) — not runes mode
- **Firebase**: Auth (Google Sign-In), Firestore (with offline persistence enabled via `persistentLocalCache` in `src/lib/firebase.ts`), Storage (progress photos)
- **Tailwind CSS** with a Gruvbox Dark palette (`src/lib/gruvbox.ts`, `text-gb-*`/`bg-gb-*` utility classes)
- **Chart.js** (via `LineChart.svelte`) for the Metrics chart
- **Vitest + @testing-library/svelte** for tests
- Deployed to **Cloudflare Pages** (`wrangler.jsonc`)

## Commands

- `npm run dev` — dev server
- `npm run check` — type-check (svelte-check); must be 0 errors before committing
- `npx vitest run` — full test suite
- `npm run build` — production build

## Architecture

### Data flow

Every Firestore-backed store in `src/lib/stores/` follows the same shape: a writable + a `*Loading` writable, an `init*(userId)` function that returns an `onSnapshot` unsubscribe, and plain async `save*`/`add*`/`delete*` functions. Stores shared across multiple pages (`tags`, `days`, `tasks`, `exercises`, `splits`, `generalRules`) are subscribed **once**, in `src/routes/+layout.svelte`'s `onMount`, keyed off the `user` store — not per-page. This was a deliberate fix for redundant re-reads; don't add per-page `onMount` subscriptions for these stores. Page-specific stores (`measurements`, `bodyMeasurements`) still subscribe in their own page/component.

### Component decomposition pattern

`DayDetail.svelte` (day edit/view modal content) and the Stats page were both split from large monoliths into small field-level components, each owning both its read-only and edit-mode rendering behind a `readonly: boolean` prop (see `DayPhotos.svelte`, `DayTagsField.svelte`, `DaySplitsExercises.svelte`, and `DayDetailView.svelte`/`DayDetailEditForm.svelte`; similarly `MetricsChart.svelte`/`MeasurementsTable.svelte` under `stats/+page.svelte`). Follow this pattern for new day-detail or stats fields rather than growing those files further. `FormField.svelte` is the shared label+input component — use it for new labeled text/date inputs instead of hand-rolling the label/input pair.

**Numeric text input gotcha:** Svelte's `bind:value` on `<input type="number">` silently coerces the bound value to `number | null` (never a string) via its own `to_number()` — clearing the field produces `null`, not `''`. Fields that need to distinguish "never entered" from "cleared" (like measurement/metric drafts) use `type="text" inputmode="decimal"` instead, keeping the bound value a genuine string, and guard parsed values with `Number.isFinite(...)` before saving (see `MeasurementsTable.svelte`, `MetricsChart.svelte`).

### Terminology note

"Splits" (a training split like Push/Pull/Legs) were originally modeled as generic "plan notes" — the type is now `Split` and the store is `src/lib/stores/splits.ts`, but the underlying Firestore collection is still literally named `notes` (a deferred migration, tracked via a comment in `splits.ts`). Don't be surprised by `'notes'` string literals inside `splits.ts` — that's intentional, not a bug.

Similarly, the Stats page's "Metrics" pill (weight/muscle/fat/BFP/score) reads from a Firestore collection named `metrics`, while the separate "Measurements" pill (tape-measure body circumference tracking) reads from a collection named `measurements` — these swapped names during a rename; see `docs/superpowers/specs/2026-07-02-body-measurements-table-design.md` if the history is confusing.

## Testing conventions

- Every store and component gets a co-located `*.test.ts`.
- Components using Svelte's two-way `bind:` props or `createEventDispatcher` events need a thin `*Test.svelte` wrapper component to observe them from a test (`component.$on(...)` is not reliable here) — see `DayModalTest.svelte`, `TagChipTest.svelte`, `DayDetailViewTest.svelte` for the pattern.
- jsdom lacks the Web Animations API and `Element.animate` — `src/test-setup.ts` stubs it so components using Svelte transitions (`transition:slide`, etc.) don't crash in tests.
- Mock Firebase modules (`$lib/firebase`, `firebase/firestore`, `firebase/storage`) at the top of store tests; don't hit real Firebase in tests.

## Requirements (original brief)

- Calendar view where a day can be highlighted with custom colors for different training types (e.g. blue = weight-lifting, red = boxing), multiple colors per day.
- A markdown text area for training schedules/quotes/notes on the main view.
- Clicking a day opens a detail view to log training types, splits, exercises/sets, daily tasks, a freeform note (bodyweight, PRs, etc.), and progress photos.
- Left nav (desktop) / bottom tab bar (mobile); more screens added over time (Stats, Split Design, Settings, Train — a rest-timer + quick exercise log page).
- Mobile-first — primary usage is logging from a phone during/after a workout.
- Google Sign-In required to access the app.
