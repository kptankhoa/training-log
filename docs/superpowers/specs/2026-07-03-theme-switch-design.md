# Dark / Light Theme Switch — Design Spec
_2026-07-03_

## Overview

Add a dark/light mode toggle in Settings, persisted per-account, with a Gruvbox Light palette added alongside the existing (implicit) Gruvbox Dark palette. Built the way it would have been if theming had been designed in from the start: Tailwind's native `darkMode: 'class'` + `dark:` variant convention, applied to every existing `gb-*` utility class usage in the app (445 occurrences across 24 files) rather than a CSS-variable shortcut. This is explicitly the more expensive path, chosen deliberately over a lower-cost alternative (see "Rejected approach" below).

**This spec covers the design only. Implementation happens in a follow-up plan, and the resulting code changes are not committed until reviewed and explicitly approved** — this is a large, mechanical, easy-to-verify-but-hard-to-eyeball-every-line change, and the user wants to see the actual diff before it lands.

---

## Persistence

New store `src/lib/stores/theme.ts`, following the same shape as `src/lib/stores/generalRules.ts`:

```ts
export type Theme = 'dark' | 'light';
export const theme: Readable<Theme>;               // defaults to 'dark'
export function initTheme(userId: string): () => void;  // onSnapshot on users/{userId}/meta/preferences
export async function setTheme(userId: string, value: Theme): Promise<void>;
```

Firestore doc: `users/{userId}/meta/preferences` with a `{ theme: 'dark' | 'light' }` field — a new doc, not reusing `generalRules`'s doc, keeping unrelated settings separate (matches the existing convention of one doc per distinct concern under `meta`).

Since this is a pure client-side SPA (`ssr = false`, no server to bake the right class into the initial HTML), the resolved theme is also cached in `localStorage` (`key: 'theme'`) so a **synchronous inline script in `app.html`**, running before Svelte mounts, can apply the `.dark` class to `<html>` immediately — no flash of the wrong theme on reload for a returning user. Sequence:

1. Inline script in `app.html` reads `localStorage.theme` (default `'dark'` if absent) and sets `document.documentElement.classList.toggle('dark', theme === 'dark')` synchronously, before first paint.
2. `src/routes/+layout.svelte` (already the home for shared, session-scoped store subscriptions — `initTags`, `initDays`, etc.) calls `initTheme(userId)` alongside those, and reactively applies whatever value the store settles on to both the live `.dark` class and `localStorage` — this is the authoritative, cross-device value; it only visibly changes anything if it differs from what localStorage had cached (e.g. theme changed on another device).
3. Toggling in Settings calls `setTheme`, which writes to Firestore. The same reactive statement in `+layout.svelte` that applies the initial value is what reacts to this change too — `setTheme` itself doesn't need to touch the DOM directly, since the write immediately reflects back through the Firestore listener (including via `persistentLocalCache`'s optimistic local update, so this doesn't wait on the network round trip in practice).

## Color System

`tailwind.config.js`:
- `darkMode: 'class'` (Tailwind's standard convention — a `.dark` class on an ancestor, normally `<html>`, activates all `dark:`-prefixed utilities).
- The existing `colors.gb.*` block is unchanged (still the dark palette). A new nested `colors.gb.light.*` group is added with the light palette (table below), generating classes like `bg-gb-light-bg`, `text-gb-light-fg3`, etc.

**Every existing `gb-*` utility class usage gets a light-mode sibling.** The transformation is mechanical and identical everywhere: `{prefix}-gb-{token}` → `{prefix}-gb-light-{token} dark:{prefix}-gb-{token}`, for every Tailwind color-consuming prefix in use (`bg`, `text`, `border`, plus a handful of one-off `ring`/`accent`/`caret`/`shadow`-style prefixes if present). The unprefixed class (light) is Tailwind's default when no `.dark` ancestor is present; `dark:`-prefixed classes (existing, byte-for-byte unchanged) apply only when `.dark` is present — which is the default for everyone, matching the "dark by default" decision below.

Applied via a scripted, whole-repo find/replace (not manual per-file editing) given the volume (445 occurrences / 24 files), followed by full-suite + type-check + build verification and a manual visual pass in both themes.

**Gruvbox Light palette** (mirrors the existing dark palette's `bg`/`bg0`/`bg1`/`bg2`/`bg3`/`fg`/`fg2`/`fg3`/`gray`/accent structure; official Gruvbox Light hex values; accents use the official "neutral" light-mode variants for contrast against a light background):

| Token | Dark (unchanged) | Light (new) |
|---|---|---|
| `bg` | `#1d2021` | `#f9f5d7` |
| `bg0` (nav chrome) | `#161819` | `#f2e5bc` |
| `bg1` | `#282828` | `#fbf1c7` |
| `bg2` | `#3c3836` | `#ebdbb2` |
| `bg3` | `#504945` | `#d5c4a1` |
| `fg` | `#ebdbb2` | `#3c3836` |
| `fg2` | `#d5c4a1` | `#504945` |
| `fg3` | `#bdae93` | `#665c54` |
| `gray` | `#928374` | `#928374` (kept identical — official Gruvbox's gray works passably on both; not swapped to a light-specific shade to avoid introducing a token whose dark/light values diverge for no visual reason) |
| `red` | `#fb4934` | `#9d0006` |
| `green` | `#b8bb26` | `#79740e` |
| `yellow` | `#fabd2f` | `#b57614` |
| `blue` | `#83a598` | `#076678` |
| `purple` | `#d3869b` | `#8f3f71` |
| `aqua` | `#8ec07c` | `#427b58` |
| `orange` | `#fe8019` | `#af3a03` |

### Non-Tailwind color consumers

Two things don't go through Tailwind classes at all, so the `dark:` mechanism doesn't reach them regardless of approach — both need explicit theme-awareness:

- **`GRUVBOX_COLORS`** (`src/lib/gruvbox.ts`) — the accent hex map used for tag/split colored dots (7 consuming files: `Calendar.svelte`, `DayTagsField.svelte`, `DaySplitsExercises.svelte`, `TagChip.svelte`, and the Settings/Splits/Train pages). Becomes a derived store keyed off the theme store, e.g. `gruvboxColors: Readable<Record<GruvboxColor, string>>`, resolving to the dark or light accent table above. Consumers change from `GRUVBOX_COLORS[tag.color]` to `$gruvboxColors[tag.color]` — a small, mechanical, one-line-per-usage diff.
- **`LineChart.svelte`** — Chart.js draws to canvas and never sees CSS. It subscribes to the theme store directly and picks literal hex values for its grid/tick/legend colors based on the current theme, and its existing reactive re-render block (`$: if (canvas) { ... render(); }`) gets the theme store added to its dependencies so an already-rendered chart repaints when the theme changes.

### Hand-rolled CSS effects (`src/app.css`)

The CRT scanline/grain overlay, `.glow-green` text-shadow, and the green block caret are raw CSS, not utility classes — per the earlier decision, both themes keep these effects, re-colored. Each gets a light-mode override written directly against the `.dark`/no-`.dark` state (mirroring the same selector convention as the rest of the app, e.g. `html:not(.dark) .glow-green { text-shadow: ...light rgba...; }`), rather than duplicating classes in markup — these were never Tailwind utilities in markup to begin with.

## Default Theme

Dark, for every user (existing or new) who hasn't explicitly set a preference — matches the app's only look today, no surprise for the existing user.

## Settings UI

A new "Appearance" section in `settings/+page.svelte`, positioned immediately before "Account". Like Account, it's a single control, not a list — so neither is behind an accordion (consistent with the earlier decision to keep Account always-visible). The control is a two-pill segmented toggle ("Dark" | "Light"), matching the pill-button style already used elsewhere (Stats page tabs, Train's split picker) rather than a generic switch. Clicking a pill calls `setTheme(userId, value)`.

## Rejected Approach

A CSS-custom-properties approach was considered first: define each `gb-*` color as a CSS variable, override the variables under a theme class, and leave every existing Tailwind class untouched. This achieves the identical runtime behavior (flip one class on `<html>`, whole app repaints) at a fraction of the diff size (zero component files touched). It was rejected in favor of the Tailwind-native `dark:` approach above because the user explicitly wants the "proper," idiomatic-to-Tailwind version even at the higher cost, as if theming had been part of the original design.

## Testing

- `src/lib/stores/theme.test.ts` — mirrors `generalRules.test.ts`'s pattern: init/populate, `setTheme` writes to Firestore, default value when no doc exists.
- `LineChart.test.ts` (currently doesn't exist — component has no test today, unrelated to this change) is out of scope; manual verification that the chart repaints on theme change is done visually, not via a new automated test, since Chart.js canvas output isn't practically assertable in jsdom.
- No test changes needed for the 24 files receiving the mechanical class-doubling — their existing tests assert on text content, ARIA labels, and behavior, not literal class strings (spot-checked; a few tests do assert `.className` for state, e.g. "hidden" class checks — these check for the presence of an unrelated class like `hidden`/`border-gb-green`, which stays exactly as a substring inside the doubled class list, so `toContain(...)` assertions remain valid).
- Manual pass in the browser: toggle the switch, confirm every page (Home, Calendar, Train, Splits, Stats, Settings) and the Day Detail modal render correctly in both themes, confirm the CRT/glow effects are visible and appropriately colored in both, confirm the chart repaints, confirm a reload doesn't flash the wrong theme.

## Out of Scope

- Following the OS/browser's `prefers-color-scheme` (rejected during brainstorming — dark is always the default absent an explicit choice).
- Per-page or per-component theme overrides — it's a single global switch.
- Committing the implementation as part of this spec — see the note under Overview.
