# Dark / Light Theme Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dark/light theme toggle in Settings, persisted per-account to Firestore, using Tailwind's native `darkMode: 'class'` + `dark:` variant convention applied across every existing `gb-*` color utility in the app, plus a Gruvbox Light palette.

**Architecture:** `tailwind.config.js` gains `darkMode: 'class'` and a parallel `gb.light.*` color group. Every one of the 445 existing `gb-*` class occurrences across 24 files gets a light-mode sibling via a one-time scripted codemod (`{prefix}-gb-{token}` → `{prefix}-gb-light-{token} dark:{prefix}-gb-{token}`) — the unprefixed class is now the light theme (Tailwind's default absent a `.dark` ancestor), the existing `dark:`-prefixed class is byte-for-byte unchanged dark-theme styling. A new `theme` store persists to `users/{userId}/meta/preferences` (mirroring `generalRules.ts`'s pattern) and caches to `localStorage` for flash-free reload. Two non-Tailwind color consumers (`GRUVBOX_COLORS`, `LineChart.svelte`'s Chart.js colors) become theme-reactive separately, since Tailwind's `dark:` mechanism never reaches plain JS.

**Tech Stack:** SvelteKit 2, Svelte 5 legacy syntax, Tailwind CSS 3.4, Firebase Firestore, Chart.js, Vitest.

## Global Constraints

- Default theme is **dark** for every user without an explicit preference — no `prefers-color-scheme` detection.
- Firestore doc: `users/{userId}/meta/preferences`, field `theme: 'dark' | 'light'`.
- `localStorage` key: `'theme'`, values `'dark'` or `'light'`.
- The `.dark` class (not `.light`) is the toggle — Tailwind's `darkMode: 'class'` convention expects `dark:`-prefixed utilities to activate under a `.dark` ancestor. Unprefixed `gb-*` classes are therefore the **light** theme.
- Gruvbox Light palette (official hex values, mirrors the existing dark palette's token structure):

  | Token | Dark (unchanged) | Light (new) |
  |---|---|---|
  | `bg` | `#1d2021` | `#e5e1c8` |
  | `bg0` | `#161819` | `#ded1ad` |
  | `bg1` | `#282828` | `#e7ddb8` |
  | `bg2` | `#3c3836` | `#d7c7a3` |
  | `bg3` | `#504945` | `#c1b092` |
  | `fg` | `#ebdbb2` | `#3c3836` |
  | `fg2` | `#d5c4a1` | `#504945` |
  | `fg3` | `#bdae93` | `#665c54` |
  | `gray` | `#928374` | `#928374` |
  | `red` | `#fb4934` | `#9d0006` |
  | `green` | `#b8bb26` | `#79740e` |
  | `yellow` | `#fabd2f` | `#b57614` |
  | `blue` | `#83a598` | `#076678` |
  | `purple` | `#d3869b` | `#8f3f71` |
  | `aqua` | `#8ec07c` | `#427b58` |
  | `orange` | `#fe8019` | `#af3a03` |

- **`bg`/`bg0`/`bg1`/`bg2`/`bg3` light values are a custom dimmed variant, not stock Gruvbox Light.** The official Gruvbox Light "hard contrast" backgrounds (`#f9f5d7`/`#f2e5bc`/`#fbf1c7`/`#ebdbb2`/`#d5c4a1`) read as too bright/glaring in practice; the values above are each ~20 units darker per channel (same relative ordering preserved: `bg0` stays the darkest of the group, mirroring dark mode's `bg0` also being darker than `bg`). All other light tokens (`fg`/`fg2`/`fg3`/`gray`/accents) are unchanged stock Gruvbox Light values.
- **Do not run `git commit` for any task in this plan.** Stage changes (`git add`) after each task's verification passes, but hold every commit until the user has reviewed the full working-tree diff and explicitly approves. This overrides this skill's normal per-task commit step.
- Run `npx vitest run`, `npm run check`, and (for the final task) `npm run build` after every task; all must be clean before moving on.

---

### Task 1: Tailwind config — `darkMode` + Gruvbox Light palette

**Files:**
- Modify: `tailwind.config.js`

**Interfaces:**
- Produces: Tailwind classes `bg-gb-light-{token}`, `text-gb-light-{token}`, `border-gb-light-{token}`, etc. for every token in the Global Constraints table, and enables the `dark:` variant prefix globally. Consumed by Tasks 3 and 7.

- [ ] **Step 1: Replace the file**

Replace the entire contents of `tailwind.config.js` with:

```js
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        gb: {
          bg:     '#1d2021',
          bg0:    '#161819',
          bg1:    '#282828',
          bg2:    '#3c3836',
          bg3:    '#504945',
          fg:     '#ebdbb2',
          fg2:    '#d5c4a1',
          fg3:    '#bdae93',
          gray:   '#928374',
          red:    '#fb4934',
          green:  '#b8bb26',
          yellow: '#fabd2f',
          blue:   '#83a598',
          purple: '#d3869b',
          aqua:   '#8ec07c',
          orange: '#fe8019',
          light: {
            bg:     '#f9f5d7',
            bg0:    '#f2e5bc',
            bg1:    '#fbf1c7',
            bg2:    '#ebdbb2',
            bg3:    '#d5c4a1',
            fg:     '#3c3836',
            fg2:    '#504945',
            fg3:    '#665c54',
            gray:   '#928374',
            red:    '#9d0006',
            green:  '#79740e',
            yellow: '#b57614',
            blue:   '#076678',
            purple: '#8f3f71',
            aqua:   '#427b58',
            orange: '#af3a03',
          },
        }
      }
    }
  },
  plugins: [typography]
};
```

- [ ] **Step 2: Verify the build still succeeds**

Run: `npm run build`
Expected: build succeeds (no `gb-light-*` classes are referenced in markup yet, so none will appear in the compiled CSS at this point — that's expected and gets confirmed once Task 7 introduces real usages).

- [ ] **Step 3: Stage (do not commit)**

```bash
git add tailwind.config.js
```

---

### Task 2: `theme` store

**Files:**
- Create: `src/lib/stores/theme.ts`
- Create: `src/lib/stores/theme.test.ts`

**Interfaces:**
- Produces: `export type Theme = 'dark' | 'light';`, `theme: Readable<Theme>` (initializes from `localStorage.theme`, defaulting to `'dark'` if absent), `initTheme(userId: string): () => void`, `setTheme(userId: string, value: Theme): Promise<void>`. Consumed by Tasks 4, 5, 6, 8.

The store's initial value is seeded from `localStorage` (not hardcoded to `'dark'`) so it agrees with whatever Task 3's inline FOUC script already applied to `<html>` before Svelte mounted. If it defaulted to `'dark'` unconditionally, a returning user cached as `'light'` would see the page flash dark for one tick in `+layout.svelte` (Task 4) before `initTheme`'s Firestore listener resolves and corrects it back — this app is `ssr: false` everywhere, so referencing `localStorage` directly at module load is safe (this module never runs outside a browser or jsdom).

- [ ] **Step 1: Write the failing test**

Create `src/lib/stores/theme.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn(() => ({}));

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
}));

describe('theme store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it('defaults to dark when localStorage has no cached value', async () => {
    const { theme } = await import('./theme');
    expect(get(theme)).toBe('dark');
  });

  it('initializes from a cached light value in localStorage', async () => {
    localStorage.setItem('theme', 'light');
    const { theme } = await import('./theme');
    expect(get(theme)).toBe('light');
  });

  it('initTheme sets the store to light when the doc says light', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ data: () => ({ theme: 'light' }) });
      return () => {};
    });
    const { theme, initTheme } = await import('./theme');
    initTheme('user1');
    expect(get(theme)).toBe('light');
  });

  it('initTheme defaults to dark when the doc has no theme field', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ data: () => undefined });
      return () => {};
    });
    const { theme, initTheme } = await import('./theme');
    initTheme('user1');
    expect(get(theme)).toBe('dark');
  });

  it('setTheme calls setDoc with the given value and merge:true', async () => {
    const { setTheme } = await import('./theme');
    await setTheme('user1', 'light');
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { theme: 'light' }, { merge: true });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'user1', 'meta', 'preferences');
  });

  it('initTheme returns an unsubscribe function', async () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    const { initTheme } = await import('./theme');
    const returned = initTheme('user1');
    expect(returned).toBe(unsub);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/stores/theme.test.ts`
Expected: FAIL — `Cannot find module './theme'` (file doesn't exist yet).

- [ ] **Step 3: Implement the store**

Create `src/lib/stores/theme.ts`:

```ts
import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export type Theme = 'dark' | 'light';

function initialTheme(): Theme {
  return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
}

const _theme = writable<Theme>(initialTheme());
export const theme = { subscribe: _theme.subscribe };

export function initTheme(userId: string): () => void {
  return onSnapshot(doc(db, 'users', userId, 'meta', 'preferences'), (snap) => {
    const value = snap.data()?.theme;
    _theme.set(value === 'light' ? 'light' : 'dark');
  });
}

export async function setTheme(userId: string, value: Theme): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'meta', 'preferences'), { theme: value }, { merge: true });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/stores/theme.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 6: Stage (do not commit)**

```bash
git add src/lib/stores/theme.ts src/lib/stores/theme.test.ts
```

---

### Task 3: FOUC-avoidance script + `app.css` theme overrides

**Files:**
- Modify: `src/app.html`
- Modify: `src/app.css`

**Interfaces:**
- Consumes: the `localStorage` key `'theme'` (Global Constraints) — this task is what first reads/writes it, ahead of Task 2's store existing at runtime.
- Produces: the `.dark` class applied to `<html>` before first paint on every load; theme-aware `.glow-green`, caret color, and base body colors.

- [ ] **Step 1: Add the inline FOUC-avoidance script to `app.html`**

In `src/app.html`, add a `<script>` tag inside `<head>`, right after the `<title>`/`<link rel="icon">` line and before the font `<link>` tags, so it runs as early as possible:

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Training Log</title>
		<link rel="icon" href="/favicon.ico" />
		<script>
			(function () {
				var stored = localStorage.getItem('theme');
				document.documentElement.classList.toggle('dark', stored !== 'light');
			})();
		</script>
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
		<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
		%sveltekit.head%
	</head>
	<body data-sveltekit-preload-data="hover">
		<div style="display: contents">%sveltekit.body%</div>
	</body>
</html>
```

(`stored !== 'light'` means: no value yet, or any value other than exactly `'light'`, defaults to dark — matching the "dark by default" constraint.)

- [ ] **Step 2: Update `app.css`'s theme-dependent rules**

Replace the entire contents of `src/app.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body {
    @apply bg-gb-light-bg text-gb-light-fg dark:bg-gb-bg dark:text-gb-fg min-h-dvh;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  }

  /* Grain overlay */
  body::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
    opacity: 0.10;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.45' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-repeat: repeat;
  }

  /* Scanline overlay */
  body::after {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 2px,
      rgba(0, 0, 0, 0.08) 2px,
      rgba(0, 0, 0, 0.08) 4px
    );
  }

  /* Ensure content sits above overlays */
  #svelte, nav, main, dialog, [role="dialog"] {
    position: relative;
    z-index: 1;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { @apply bg-gb-light-bg3 dark:bg-gb-bg3 rounded; }
  ::-webkit-scrollbar-thumb:hover { @apply bg-gb-light-gray dark:bg-gb-gray; }

  ::selection { @apply bg-gb-light-green text-gb-light-bg dark:bg-gb-green dark:text-gb-bg; }

  /* Retro pixel cursors */
  html, body {
    cursor: url('/cursors/arrow.svg') 3 1, default;
  }
  button, a, [role='button'], label, select {
    cursor: url('/cursors/pointer.svg') 10 2, pointer !important;
  }

  /* Sharp corners everywhere */
  *, *::before, *::after {
    border-radius: 0 !important;
  }

  /* Green block caret on inputs (light theme's green accent, darker for contrast) */
  input, textarea {
    caret-color: #79740e;
    caret-shape: block;
  }
  .dark input, .dark textarea {
    caret-color: #b8bb26;
  }

  /* Hide number input spin buttons */
  input[type='number'] {
    -moz-appearance: textfield;
  }
  input[type='number']::-webkit-outer-spin-button,
  input[type='number']::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}

@layer utilities {
  .glow-green {
    text-shadow:
      0 0 8px rgba(121, 116, 14, 0.6),
      0 0 20px rgba(121, 116, 14, 0.25);
  }
  .dark .glow-green {
    text-shadow:
      0 0 8px rgba(184, 187, 38, 0.7),
      0 0 20px rgba(184, 187, 38, 0.3);
  }
}
```

(The scanline/grain overlay uses neutral black `rgba(0,0,0,...)` values, not tied to the green accent, so both themes keep them completely unchanged — a black scanline/grain overlay reads fine over both a light and dark base.)

- [ ] **Step 3: Verify the build succeeds**

Run: `npm run build`
Expected: build succeeds. (Full visual confirmation of the two themes happens in Task 8's manual check, once the rest of the app has real `dark:`-paired classes to render.)

- [ ] **Step 4: Stage (do not commit)**

```bash
git add src/app.html src/app.css
```

---

### Task 4: Wire `theme` into `+layout.svelte`

**Files:**
- Modify: `src/routes/+layout.svelte`

**Interfaces:**
- Consumes: `theme`, `initTheme` from `$lib/stores/theme` (Task 2).

This task only touches the `<script>` block — the template's own `gb-*` classes (the loading spinner) are handled uniformly by Task 7's codemod, not here.

- [ ] **Step 1: Update the script block**

In `src/routes/+layout.svelte`, add the theme import and wire it into the existing shared-store `onMount`, plus a new reactive block that keeps the live class and `localStorage` in sync:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { user, authReady } from '$lib/stores/auth';
  import { initTags } from '$lib/stores/tags';
  import { initDays } from '$lib/stores/days';
  import { initTasks } from '$lib/stores/tasks';
  import { initExercises } from '$lib/stores/exercises';
  import { initSplits } from '$lib/stores/splits';
  import { initGeneralRules } from '$lib/stores/generalRules';
  import { theme, initTheme } from '$lib/stores/theme';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import Sidebar from '$lib/components/shell/Sidebar.svelte';

  $: if (browser && $authReady && $user === null && $page.url.pathname !== '/login') {
    goto('/login');
  }

  // Data shared across every page (calendar, home, settings, splits, train) —
  // subscribed once per login here instead of re-subscribing in each page's
  // onMount, which used to re-read these collections in full on every navigation.
  onMount(() => {
    const unsubs: (() => void)[] = [];
    const unsubUser = user.subscribe((u) => {
      unsubs.forEach((fn) => fn());
      unsubs.length = 0;
      if (!u) return;
      unsubs.push(initTags(u.uid));
      unsubs.push(initDays(u.uid));
      unsubs.push(initTasks(u.uid));
      unsubs.push(initExercises(u.uid));
      unsubs.push(initSplits(u.uid));
      unsubs.push(initGeneralRules(u.uid));
      unsubs.push(initTheme(u.uid));
    });
    return () => {
      unsubUser();
      unsubs.forEach((fn) => fn());
    };
  });

  // Keep the live <html> class and the FOUC-avoidance localStorage cache
  // (read synchronously by the inline script in app.html) in sync with
  // whatever the theme store resolves to.
  $: if (browser) {
    document.documentElement.classList.toggle('dark', $theme === 'dark');
    localStorage.setItem('theme', $theme);
  }

  $: showShell = $authReady && $user !== null && $page.url.pathname !== '/login';
  $: loading = !$authReady;
</script>
```

(The rest of the file — the `{#if loading}`/`{#if showShell}` template block — is unchanged in this task.)

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: all tests still pass (no test file targets `+layout.svelte` — this project doesn't unit-test route/layout files).

- [ ] **Step 4: Stage (do not commit)**

```bash
git add src/routes/+layout.svelte
```

---

### Task 5: Theme-reactive `GRUVBOX_COLORS`

**Files:**
- Modify: `src/lib/gruvbox.ts`
- Modify: `src/lib/gruvbox.test.ts`
- Modify: `src/lib/components/calendar/Calendar.svelte`
- Modify: `src/lib/components/calendar/Calendar.test.ts`
- Modify: `src/lib/components/day-detail/DayTagsField.svelte`
- Modify: `src/lib/components/day-detail/DayTagsField.test.ts`
- Modify: `src/lib/components/day-detail/DaySplitsExercises.svelte`
- Modify: `src/lib/components/day-detail/DaySplitsExercises.test.ts`
- Modify: `src/lib/components/day-detail/TagChip.svelte`
- Modify: `src/lib/components/day-detail/TagChip.test.ts`
- Modify: `src/lib/components/day-detail/DayDetailView.test.ts`
- Modify: `src/lib/components/day-detail/DayDetailEditForm.test.ts`
- Modify: `src/lib/components/day-detail/DayDetail.test.ts`
- Modify: `src/lib/components/day-detail/DayModal.test.ts`
- Modify: `src/routes/settings/+page.svelte`
- Modify: `src/routes/splits/+page.svelte`
- Modify: `src/routes/train/+page.svelte`

**Interfaces:**
- Consumes: `theme` from `$lib/stores/theme` (Task 2).
- Produces: `gruvboxColors: Readable<Record<GruvboxColor, string>>`, replacing the removed `GRUVBOX_COLORS` export. `COLOR_ORDER` and `nextColor` are unchanged.

`gruvbox.ts` gaining a dependency on `theme.ts` (which imports `$lib/firebase`) means every test file that renders a component depending on `gruvbox.ts`, even transitively, needs `$lib/stores/theme` mocked — otherwise it tries to boot real Firebase inside jsdom. `Calendar`, `DayTagsField`, `DaySplitsExercises`, and `TagChip` import it directly; `DayDetailView`, `DayDetailEditForm`, `DayDetail`, and `DayModal` render those as children, so their test files need the same mock even though their own `.svelte` source never mentions `gruvbox.ts`.

- [ ] **Step 1: Write the failing test**

In `src/lib/gruvbox.test.ts`, add (keep the existing `nextColor` describe block above this, unchanged):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { nextColor } from './gruvbox';
import type { GruvboxColor } from './types';

// ... existing `describe('nextColor', ...)` block stays exactly as-is above this line ...

const mocks = vi.hoisted(() => ({ theme: 'dark' as 'dark' | 'light' }));
vi.mock('./stores/theme', () => ({
  theme: { subscribe: (cb: (v: 'dark' | 'light') => void) => { cb(mocks.theme); return () => {}; } }
}));

describe('gruvboxColors', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('resolves to the dark accent palette by default', async () => {
    mocks.theme = 'dark';
    const { gruvboxColors } = await import('./gruvbox');
    expect(get(gruvboxColors).red).toBe('#fb4934');
  });

  it('resolves to the light accent palette when theme is light', async () => {
    mocks.theme = 'light';
    const { gruvboxColors } = await import('./gruvbox');
    expect(get(gruvboxColors).red).toBe('#9d0006');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/gruvbox.test.ts`
Expected: FAIL — `gruvboxColors` is not exported by `./gruvbox` (doesn't exist yet).

- [ ] **Step 3: Implement `gruvboxColors` in `gruvbox.ts`**

Replace the entire contents of `src/lib/gruvbox.ts` with:

```ts
import { derived } from 'svelte/store';
import { theme } from './stores/theme';
import type { GruvboxColor } from './types';

const GRUVBOX_DARK: Record<GruvboxColor, string> = {
  red:    '#fb4934',
  green:  '#b8bb26',
  yellow: '#fabd2f',
  blue:   '#83a598',
  purple: '#d3869b',
  aqua:   '#8ec07c',
  orange: '#fe8019',
};

const GRUVBOX_LIGHT: Record<GruvboxColor, string> = {
  red:    '#9d0006',
  green:  '#79740e',
  yellow: '#b57614',
  blue:   '#076678',
  purple: '#8f3f71',
  aqua:   '#427b58',
  orange: '#af3a03',
};

export const gruvboxColors = derived(theme, ($theme) => ($theme === 'dark' ? GRUVBOX_DARK : GRUVBOX_LIGHT));

export const COLOR_ORDER: GruvboxColor[] = [
  'red', 'green', 'yellow', 'blue', 'purple', 'aqua', 'orange'
];

export function nextColor(usedColors: GruvboxColor[]): GruvboxColor {
  const used = new Set(usedColors);
  for (const color of COLOR_ORDER) {
    if (!used.has(color)) return color;
  }
  return COLOR_ORDER[usedColors.length % COLOR_ORDER.length];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/gruvbox.test.ts`
Expected: PASS (6 tests: 4 existing `nextColor` + 2 new `gruvboxColors`)

- [ ] **Step 5: Update the 7 consuming source files**

In `src/lib/components/day-detail/TagChip.svelte`, change:
```ts
import { GRUVBOX_COLORS } from '$lib/gruvbox';
```
to:
```ts
import { gruvboxColors } from '$lib/gruvbox';
```
and change:
```ts
$: hex = GRUVBOX_COLORS[tag.color];
```
to:
```ts
$: hex = $gruvboxColors[tag.color];
```

In `src/lib/components/day-detail/DayTagsField.svelte`, change the import the same way, and change:
```svelte
<span class="w-2.5 h-2.5 shrink-0" style="background-color:{GRUVBOX_COLORS[tag.color]}"></span>
```
to:
```svelte
<span class="w-2.5 h-2.5 shrink-0" style="background-color:{$gruvboxColors[tag.color]}"></span>
```

In `src/lib/components/day-detail/DaySplitsExercises.svelte`, change the import the same way, and change:
```svelte
<span class="w-2.5 h-2.5 shrink-0" style="background-color:{GRUVBOX_COLORS[split.color ?? 'blue']}"></span>
```
to:
```svelte
<span class="w-2.5 h-2.5 shrink-0" style="background-color:{$gruvboxColors[split.color ?? 'blue']}"></span>
```

In `src/lib/components/calendar/Calendar.svelte`, change the import the same way, and change all four usages:
```ts
colors: (entry?.tags ?? []).map((id) => tagMap[id]).filter(Boolean).map((t) => GRUVBOX_COLORS[t.color]),
splitColors: (entry?.splitIds ?? []).map((id) => splitMap[id]).filter(Boolean).map((s) => GRUVBOX_COLORS[s.color ?? 'blue']),
```
to:
```ts
colors: (entry?.tags ?? []).map((id) => tagMap[id]).filter(Boolean).map((t) => $gruvboxColors[t.color]),
splitColors: (entry?.splitIds ?? []).map((id) => splitMap[id]).filter(Boolean).map((s) => $gruvboxColors[s.color ?? 'blue']),
```
and:
```ts
return el ? GRUVBOX_COLORS[el.color] : null;
```
to:
```ts
return el ? $gruvboxColors[el.color] : null;
```
and both:
```svelte
<span class="w-2.5 h-2.5 shrink-0" style="background-color:{GRUVBOX_COLORS[tag.color]}"></span>
```
```svelte
<span class="w-2.5 h-2.5 shrink-0" style="background-color:{GRUVBOX_COLORS[split.color]}"></span>
```
to `$gruvboxColors[...]` the same way.

In `src/routes/settings/+page.svelte`, change:
```ts
import { GRUVBOX_COLORS, COLOR_ORDER } from '$lib/gruvbox';
```
to:
```ts
import { gruvboxColors, COLOR_ORDER } from '$lib/gruvbox';
```
and change:
```svelte
style="background-color: {GRUVBOX_COLORS[tag.color]}"
```
to:
```svelte
style="background-color: {$gruvboxColors[tag.color]}"
```

In `src/routes/splits/+page.svelte`, change the import the same way as settings (`gruvboxColors, COLOR_ORDER`), and change both:
```svelte
<span class="w-3 h-3 shrink-0" style="background-color:{GRUVBOX_COLORS[split.color ?? 'blue']}"></span>
```
```svelte
style="background-color:{GRUVBOX_COLORS[draft.color]}"
```
to `$gruvboxColors[...]` the same way.

In `src/routes/train/+page.svelte`, change:
```ts
import { GRUVBOX_COLORS } from '$lib/gruvbox';
```
to:
```ts
import { gruvboxColors } from '$lib/gruvbox';
```
and change:
```svelte
<span class="w-2.5 h-2.5 shrink-0 rounded-sm" style="background-color:{GRUVBOX_COLORS[split.color ?? 'blue']}"></span>
```
to:
```svelte
<span class="w-2.5 h-2.5 shrink-0 rounded-sm" style="background-color:{$gruvboxColors[split.color ?? 'blue']}"></span>
```

- [ ] **Step 6: Add the theme mock to the 4 directly-affected test files**

At the top of each of these four files (after the existing imports, alongside any existing `vi.mock` calls), add:

```ts
vi.mock('$lib/stores/theme', () => ({
  theme: { subscribe: (cb: (v: 'dark' | 'light') => void) => { cb('dark'); return () => {}; } }
}));
```

Files: `src/lib/components/calendar/Calendar.test.ts`, `src/lib/components/day-detail/DayTagsField.test.ts`, `src/lib/components/day-detail/DaySplitsExercises.test.ts`, `src/lib/components/day-detail/TagChip.test.ts`.

`Calendar.test.ts` and `TagChip.test.ts` currently import `vitest` without `vi` (e.g. `import { describe, it, expect } from 'vitest';`) — add `vi` to that import list in both files so `vi.mock` is in scope.

- [ ] **Step 7: Add the same theme mock to the 4 transitively-affected test files**

Add the identical `vi.mock('$lib/stores/theme', ...)` block (from Step 6) to: `src/lib/components/day-detail/DayDetailView.test.ts`, `src/lib/components/day-detail/DayDetailEditForm.test.ts`, `src/lib/components/day-detail/DayDetail.test.ts`, `src/lib/components/day-detail/DayModal.test.ts`. These files don't reference `gruvbox.ts` directly, but render `DayTagsField`/`DaySplitsExercises` as children, so they hit the same transitive `$lib/firebase` import without this mock.

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass — no changes needed to any test's assertions, only the new mock plumbing above.

- [ ] **Step 9: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 10: Stage (do not commit)**

```bash
git add src/lib/gruvbox.ts src/lib/gruvbox.test.ts \
  src/lib/components/calendar/Calendar.svelte src/lib/components/calendar/Calendar.test.ts \
  src/lib/components/day-detail/DayTagsField.svelte src/lib/components/day-detail/DayTagsField.test.ts \
  src/lib/components/day-detail/DaySplitsExercises.svelte src/lib/components/day-detail/DaySplitsExercises.test.ts \
  src/lib/components/day-detail/TagChip.svelte src/lib/components/day-detail/TagChip.test.ts \
  src/lib/components/day-detail/DayDetailView.test.ts src/lib/components/day-detail/DayDetailEditForm.test.ts \
  src/lib/components/day-detail/DayDetail.test.ts src/lib/components/day-detail/DayModal.test.ts \
  src/routes/settings/+page.svelte src/routes/splits/+page.svelte src/routes/train/+page.svelte
```

---

### Task 6: Theme-reactive `LineChart` colors

**Files:**
- Modify: `src/lib/components/stats/LineChart.svelte`
- Modify: `src/lib/components/stats/MetricsChart.test.ts`

**Interfaces:**
- Consumes: `theme` from `$lib/stores/theme` (Task 2).

Chart.js draws to canvas and never sees CSS, so its grid/tick/legend colors must be picked in JS based on the current theme, and the chart must re-render when the theme changes. `LineChart` gaining this import means `MetricsChart.test.ts` (the only test that renders `LineChart`, transitively via `MetricsChart`) needs the same `$lib/stores/theme` mock as Task 5's affected files, for the same reason (avoids booting real Firebase in jsdom).

- [ ] **Step 1: Update `LineChart.svelte`**

In `src/lib/components/stats/LineChart.svelte`, add the theme import and derive the three theme-dependent colors, replacing their hardcoded literals in the Chart.js config:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
    Filler,
  } from 'chart.js';
  import { theme } from '$lib/stores/theme';

  Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

  interface Series {
    label: string;
    data: number[];
    color: string;
    unit?: string;
  }

  export let labels: string[] = [];
  // Single-series shorthand props (used when `series` is not provided)
  export let data: number[] = [];
  export let color = '#b8bb26';
  export let unit = '';
  export let beginAtZero = false;
  export let series: Series[] | null = null;

  $: lines = series ?? [{ label: '', data, color, unit }];
  $: showLegend = lines.length > 1;

  $: tickColor = $theme === 'dark' ? '#a89984' : '#7c6f64';
  $: gridColor = $theme === 'dark' ? '#3c3836' : '#ebdbb2';
  $: legendColor = $theme === 'dark' ? '#ebdbb2' : '#3c3836';

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function render() {
    if (!canvas) return;
    chart?.destroy();
    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: lines.map((s) => ({
          label: s.label,
          data: s.data,
          borderColor: s.color,
          backgroundColor: `${s.color}33`,
          fill: !showLegend,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: s.color,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero, ticks: { color: tickColor }, grid: { color: gridColor } },
          x: { ticks: { color: tickColor }, grid: { color: gridColor } },
        },
        plugins: {
          legend: { display: showLegend, labels: { color: legendColor } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const s = lines[ctx.datasetIndex];
                return `${s.label ? s.label + ': ' : ''}${ctx.parsed.y}${s.unit ?? ''}`;
              },
            },
          },
        },
      },
    });
  }

  onMount(render);
  $: if (canvas) { labels; lines; beginAtZero; tickColor; gridColor; legendColor; render(); }
  onDestroy(() => chart?.destroy());
</script>

<div class="relative h-56 w-full">
  <canvas bind:this={canvas}></canvas>
</div>
```

- [ ] **Step 2: Add the theme mock to `MetricsChart.test.ts`**

At the top of `src/lib/components/stats/MetricsChart.test.ts`, alongside its existing `vi.mock` calls, add:

```ts
vi.mock('$lib/stores/theme', () => ({
  theme: { subscribe: (cb: (v: 'dark' | 'light') => void) => { cb('dark'); return () => {}; } }
}));
```

- [ ] **Step 3: Run the affected tests**

Run: `npx vitest run src/lib/components/stats/MetricsChart.test.ts`
Expected: PASS (all existing tests, unchanged assertions — this file doesn't assert on chart colors).

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 6: Stage (do not commit)**

```bash
git add src/lib/components/stats/LineChart.svelte src/lib/components/stats/MetricsChart.test.ts
```

---

### Task 7: Codemod — double every `gb-*` class for light/dark

**Files:**
- Create (temporary, deleted at the end of this task): `scripts/theme-codemod.mjs`
- Modify: all 24 `.svelte` files under `src` that use a `gb-*` Tailwind color class (see list below)

**Interfaces:**
- Consumes: the `gb-light-*` classes from Task 1's Tailwind config.

This is a single mechanical, regular transformation applied everywhere: `{prefix}-gb-{token}` → `{prefix}-gb-light-{token} dark:{prefix}-gb-{token}`, including inside variant prefixes like `hover:`, `focus:`, and Tailwind arbitrary-selector variants like `[&_a]:`. There are 445 occurrences across these 24 files today:

```
src/lib/components/calendar/Calendar.svelte
src/lib/components/day-detail/DayDetailEditForm.svelte
src/lib/components/day-detail/DayDetailView.svelte
src/lib/components/day-detail/DayModal.svelte
src/lib/components/day-detail/DayPhotos.svelte
src/lib/components/day-detail/DaySplitsExercises.svelte
src/lib/components/day-detail/DayTagsField.svelte
src/lib/components/day-detail/ExerciseEditor.svelte
src/lib/components/shared/FormField.svelte
src/lib/components/shared/MarkdownEditor.svelte
src/lib/components/shared/Spinner.svelte
src/lib/components/shell/Sidebar.svelte
src/lib/components/stats/MeasurementsTable.svelte
src/lib/components/stats/MetricsChart.svelte
src/lib/components/stats/PhotoTimeline.svelte
src/lib/components/train/RestTimer.svelte
src/routes/+layout.svelte
src/routes/+page.svelte
src/routes/calendar/+page.svelte
src/routes/login/+page.svelte
src/routes/settings/+page.svelte
src/routes/splits/+page.svelte
src/routes/stats/+page.svelte
src/routes/train/+page.svelte
```

Do not hand-edit these files — run the script below, which finds every one of them itself (it walks `src/` for `.svelte` files, not the fixed list above; the list is just for your own sanity-checking afterward), **except** for the one normalization step below, which must happen first.

**Pre-existing gap, confirmed and resolved during planning:** `src/lib/components/calendar/Calendar.svelte:188` uses `text-gb-fg4`, a token that does not exist anywhere in `tailwind.config.js` (only `fg`/`fg2`/`fg3` exist) — it is a pre-existing no-op class, unrelated to this feature. Leave it exactly as-is; the codemod's regex will still match and double it (`text-gb-light-fg4 dark:text-gb-fg4`), which preserves its current (no-op) behavior identically in both themes. Do not attempt to fix it as part of this plan.

- [ ] **Step 1: Normalize `RestTimer.svelte`'s inline hex colors to `gb-*` classes**

`src/lib/components/train/RestTimer.svelte` is the one file in scope that sets colors via raw inline `style="color:#hex"` attributes instead of Tailwind classes — these are invisible to the codemod's class-based regex, so they must become plain `gb-*` classes *before* the codemod runs, so the codemod can double them like everything else in the file.

Replace:
```svelte
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {#if finished}
          <span class="text-xs font-semibold uppercase tracking-widest" style="color:#fb4934">Go!</span>
        {:else if running}
          <span class="text-xs uppercase tracking-widest" style="color:#a89984">Rest</span>
        {:else}
          <span class="text-xs uppercase tracking-widest opacity-0">·</span>
        {/if}
        <span class="text-2xl font-bold tabular-nums" style="color:{finished ? '#fb4934' : running ? '#b8bb26' : '#ebdbb2'}">{displayTime}</span>
      </div>
```
with:
```svelte
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {#if finished}
          <span class="text-xs font-semibold uppercase tracking-widest text-gb-red">Go!</span>
        {:else if running}
          <span class="text-xs uppercase tracking-widest text-gb-fg3">Rest</span>
        {:else}
          <span class="text-xs uppercase tracking-widest opacity-0">·</span>
        {/if}
        <span class="text-2xl font-bold tabular-nums {finished ? 'text-gb-red' : running ? 'text-gb-green' : 'text-gb-fg'}">{displayTime}</span>
      </div>
```
(`#a89984` had no matching token in the palette — it's folded into the closest existing one, `fg3`, a near-imperceptible shift used only for this "Rest" label.)

And replace:
```svelte
      <button
        type="button"
        on:click={startStop}
        disabled={totalInput === 0}
        class="px-6 py-2 font-semibold text-sm transition hover:opacity-90 disabled:opacity-40"
        style={running ? 'background:#fe8019;color:#fff' : 'background:#b8bb26;color:#1d2021'}
      >
```
with:
```svelte
      <button
        type="button"
        on:click={startStop}
        disabled={totalInput === 0}
        class="px-6 py-2 font-semibold text-sm transition hover:opacity-90 disabled:opacity-40
               {running ? 'bg-gb-orange text-white' : 'bg-gb-green text-gb-bg'}"
      >
```
(`text-white` stays a plain, non-`gb-*` class in both themes — a fixed white label reads fine against the orange accent in both palettes, so it doesn't need to double.)

- [ ] **Step 2: Run `RestTimer.test.ts` to confirm the normalization is behavior-preserving**

Run: `npx vitest run src/lib/components/train/RestTimer.test.ts`
Expected: PASS (all 8 existing tests — none assert on `style` attributes or literal colors, only on visible text and button states).

- [ ] **Step 3: Create the codemod script**

Create `scripts/theme-codemod.mjs`:

```js
// One-time codemod: doubles every `{prefix}-gb-{token}` Tailwind class into
// `{prefix}-gb-light-{token} dark:{prefix}-gb-{token}`, preserving any
// variant prefix (hover:, focus:, [&_a]:, etc.). Run once, then delete this
// file — it is not meant to be re-run (running it twice would re-match its
// own `dark:` output and double it again).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (full.endsWith('.svelte')) {
      files.push(full);
    }
  }
  return files;
}

const files = walk('src');
const PREFIXES = 'bg|text|border|from|to|via|ring|divide|accent|decoration|caret|outline|shadow';
const pattern = new RegExp(
  String.raw`((?:[\w-]+:|\[[^\]]+\]:)*)(${PREFIXES})-gb-(?!light-)([a-zA-Z0-9]+)\b`,
  'g'
);

let totalReplacements = 0;
let filesChanged = 0;
for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let count = 0;
  const updated = original.replace(pattern, (match, variants, prop, token) => {
    count++;
    return `${variants}${prop}-gb-light-${token} dark:${variants}${prop}-gb-${token}`;
  });
  if (count > 0) {
    writeFileSync(file, updated);
    console.log(`${file}: ${count} replacements`);
    totalReplacements += count;
    filesChanged++;
  }
}
console.log(`\nTotal: ${totalReplacements} replacements across ${filesChanged} files`);
```

- [ ] **Step 4: Run it**

Run: `node scripts/theme-codemod.mjs`
Expected: prints a per-file breakdown, ending with `Total: 453 replacements across 24 files`. (445 from the original class inventory, plus the 8 new `gb-*` classes introduced by Step 1's `RestTimer.svelte` normalization: `text-gb-red` ×2, `text-gb-fg3`, `text-gb-green`, `text-gb-fg`, `bg-gb-orange`, `bg-gb-green`, `text-gb-bg`.)

- [ ] **Step 5: Delete the script**

```bash
rm scripts/theme-codemod.mjs
```

(It's a one-time migration tool, not part of the app — don't leave it in the repo.)

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass. No test file needs changes — existing assertions check text content, ARIA labels, and `.className` substrings like `'hidden'` or `'border-gb-green'`, all of which remain valid substrings inside the doubled class lists (e.g. `'border-gb-green'` is still found inside `dark:border-gb-green`).

- [ ] **Step 7: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 8: Build and spot-check the compiled CSS**

Run: `npm run build`
Expected: build succeeds, and the compiled CSS now actually contains the light palette (confirming Task 1's config + this task's usages work together) — spot check with:

```bash
grep -o '#f9f5d7\|#79740e' .svelte-kit/cloudflare/_app/immutable/assets/*.css | sort -u
```
Expected: both hex values appear (confirms `gb-light-bg` and `gb-light-green` compiled in).

- [ ] **Step 9: Manually spot-check 3 files**

Read `src/lib/components/day-detail/DayPhotos.svelte`, `src/routes/settings/+page.svelte`, and `src/lib/components/train/RestTimer.svelte` in full. Confirm every `gb-*` class has a `dark:`-prefixed sibling, variant prefixes (`hover:`, `focus:`) were preserved correctly, `RestTimer.svelte`'s Step 1 normalization doubled cleanly (no leftover `style="color:...` attributes), and nothing looks mangled (e.g. no `dark:dark:`, no broken class strings).

- [ ] **Step 10: Stage (do not commit)**

```bash
git add -A
```

(This sweep touches all 24 files listed above — `git add -A` is appropriate here since Task 1-6's changes are already staged from their own tasks; this just adds everything the codemod modified.)

---

### Task 8: Settings "Appearance" toggle + final verification

**Files:**
- Modify: `src/routes/settings/+page.svelte`

**Interfaces:**
- Consumes: `theme`, `setTheme` from `$lib/stores/theme` (Task 2).

- [ ] **Step 1: Add the theme store import and a click handler**

In `src/routes/settings/+page.svelte`, add to the existing imports:

```ts
import { theme, setTheme } from '$lib/stores/theme';
```

Add a handler function alongside the file's other handlers (e.g. near `cycleColor`):

```ts
async function handleSetTheme(value: 'dark' | 'light') {
  if (!userId) return;
  await setTheme(userId, value);
}
```

- [ ] **Step 2: Add the "Appearance" section to the template**

Insert a new section immediately before the existing "Account" section (the `<section class="md:hidden flex flex-col gap-2">...Account...</section>` block at the end of the file):

```svelte
<section class="flex flex-col gap-3">
  <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2">Appearance</h2>
  <div class="flex gap-2">
    <button
      type="button"
      on:click={() => handleSetTheme('dark')}
      class="px-4 py-2 text-sm border transition
             {$theme === 'dark'
               ? 'border-gb-green text-gb-green bg-gb-bg2'
               : 'border-gb-bg3 text-gb-fg3 hover:border-gb-blue hover:text-gb-blue'}"
    >Dark</button>
    <button
      type="button"
      on:click={() => handleSetTheme('light')}
      class="px-4 py-2 text-sm border transition
             {$theme === 'light'
               ? 'border-gb-green text-gb-green bg-gb-bg2'
               : 'border-gb-bg3 text-gb-fg3 hover:border-gb-blue hover:text-gb-blue'}"
    >Light</button>
  </div>
</section>
```

(This new markup uses `gb-*` classes directly, added after Task 7's codemod already ran — so it does **not** get automatically doubled. Manually write each class with its `dark:` sibling now, following the exact same pattern the codemod applied everywhere else: `border-gb-light-green dark:border-gb-green`, etc. The block above is written in the OLD single-class form on purpose, to make the required transformation explicit — apply it before running the tests below:)

```svelte
<section class="flex flex-col gap-3">
  <h2 class="text-gb-light-fg dark:text-gb-fg font-semibold border-b border-gb-light-bg2 dark:border-gb-bg2 pb-2">Appearance</h2>
  <div class="flex gap-2">
    <button
      type="button"
      on:click={() => handleSetTheme('dark')}
      class="px-4 py-2 text-sm border transition
             {$theme === 'dark'
               ? 'border-gb-light-green dark:border-gb-green text-gb-light-green dark:text-gb-green bg-gb-light-bg2 dark:bg-gb-bg2'
               : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 hover:border-gb-light-blue hover:text-gb-light-blue dark:hover:border-gb-blue dark:hover:text-gb-blue'}"
    >Dark</button>
    <button
      type="button"
      on:click={() => handleSetTheme('light')}
      class="px-4 py-2 text-sm border transition
             {$theme === 'light'
               ? 'border-gb-light-green dark:border-gb-green text-gb-light-green dark:text-gb-green bg-gb-light-bg2 dark:bg-gb-bg2'
               : 'border-gb-light-bg3 dark:border-gb-bg3 text-gb-light-fg3 dark:text-gb-fg3 hover:border-gb-light-blue hover:text-gb-light-blue dark:hover:border-gb-blue dark:hover:text-gb-blue'}"
    >Light</button>
  </div>
</section>
```

Use this second, fully-doubled version as the actual markup to insert — the first version above was shown only to illustrate the starting point.

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: `0 ERRORS`

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (no test file targets `settings/+page.svelte` — routes aren't unit-tested in this project).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manually verify in the browser**

Run: `npm run dev`, sign in, and check:
- Reload the page a few times — no visible flash of the wrong theme.
- Go to Settings, click "Light" — the whole app (not just Settings) repaints immediately: Home, Calendar, Train (including the rest timer ring), Splits, Stats (including the chart, which should visibly redraw its grid/tick/legend colors), and opening a Day Detail modal.
- Confirm the CRT scanline/grain overlay, the `.glow-green` heading glow, and the block caret in text inputs are all visible and sensibly colored in light mode (darker green glow, not the bright dark-mode green).
- Click "Dark" — everything reverts correctly.
- Reload while on Light — the correct theme persists (confirms the Firestore round-trip + localStorage cache both work).
- Tag/split colored dots (Calendar, Day Detail, Settings, Splits, Train) should visibly use the darker "neutral" accent colors in light mode, not the bright dark-mode accents.

- [ ] **Step 7: Stage (do not commit)**

```bash
git add src/routes/settings/+page.svelte
```

**Do not run `git commit` after this or any prior task.** Once Step 6's manual check passes, tell the user the full theme switch is staged and ready for their review — they will decide when (and how) to commit.
