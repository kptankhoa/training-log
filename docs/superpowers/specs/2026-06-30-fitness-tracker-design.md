# Fitness Tracker — Design Spec
_2026-06-30_

## Overview

A personal web app to track training progress. Authenticated users log training types per day on a color-coded calendar, add markdown notes per day, and maintain a global markdown notepad. Mobile-first.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit (adapter-static, pure SPA) |
| Styling | Tailwind CSS + Gruvbox Dark palette as CSS custom properties |
| Auth | Firebase Auth — Google Sign-In |
| Database | Firestore (per-user collections) |
| Deployment | Cloudflare Pages |

SvelteKit runs fully client-side (no SSR). `+layout.svelte` guards all routes: unauthenticated users are redirected to `/login`.

---

## Project Structure

```
src/
  lib/
    firebase.ts              # Firebase init + SDK exports
    stores/
      auth.ts                # Auth state (currentUser)
      tags.ts                # Training type tags (Firestore-synced)
      days.ts                # Day entries (Firestore-synced)
      note.ts                # Global notepad (Firestore-synced)
    components/
      Sidebar.svelte          # Left nav (desktop) / bottom tab bar (mobile)
      Calendar.svelte         # Month grid with colored tag dots
      DayModal.svelte         # Day detail drawer/modal
      TagChip.svelte          # Colored tag pill
      MarkdownEditor.svelte   # Shared markdown editor component (edit + preview toggle)
  routes/
    +layout.svelte            # Auth guard + app shell
    +page.svelte              # Calendar view (/)
    stats/+page.svelte        # Stats (placeholder)
    settings/+page.svelte     # Tag management + global note
    login/+page.svelte        # Google Sign-In screen
```

---

## Data Model (Firestore)

All collections are scoped under `users/{userId}/`.

### `users/{userId}/meta` (single document)
```
globalNote: string    # Markdown content for the global notepad
```

### `users/{userId}/tags/{tagId}`
```
name:    string       # e.g. "Weight Lifting"
color:   string       # Gruvbox color key: "red" | "green" | "yellow" | "blue" | "purple" | "aqua" | "orange"
deleted: boolean      # Soft-delete: hidden from picker, still resolves on calendar
```

### `users/{userId}/days/{YYYY-MM-DD}`
```
tags:  string[]       # Array of tagIds
label: string         # Short text shown on the calendar day cell
note:  string         # Detailed markdown content for this day
```

**Tag color assignment:** New tags auto-assign the next Gruvbox accent color not yet used by an active tag (7 colors: red → green → yellow → blue → purple → aqua → orange). Once all 7 are in use, it cycles back from the start. User can override the color in Settings.

**Soft-delete:** `deleted: true` hides a tag from the picker but days that referenced it still render the correct color dot (the full tag list including deleted entries is always loaded).

---

## Gruvbox Dark Palette

Background/surface colors applied globally. Accent colors used for tags:

| Key | Hex (bright variant used for tags) |
|---|---|
| red | `#fb4934` |
| green | `#b8bb26` |
| yellow | `#fabd2f` |
| blue | `#83a598` |
| purple | `#d3869b` |
| aqua | `#8ec07c` |
| orange | `#fe8019` |

Background: `#282828`, surface: `#3c3836`, text: `#ebdbb2`.

---

## Screens

### Login (`/login`)
- Full-screen centered card with "Sign in with Google" button.
- On success, redirect to `/`.

### Calendar View (`/`)

**Layout (desktop):**
- Left sidebar (fixed) + main content area.
- Main area: month calendar grid on top, global markdown notepad below.

**Layout (mobile):**
- Bottom tab bar replaces sidebar.
- Calendar takes full width. Global notepad scrolls below.

**Calendar grid:**
- Month navigation (`< Month Year >`).
- Each day cell shows:
  - Day number
  - A row of colored dots (one per tag applied that day)
  - The day's `label` text if set (truncated to fit)
  - A subtle content indicator (e.g. a small corner dot or underline in the muted text color) when a detailed note exists for that day
- Tapping/clicking a day opens `DayModal`.

### Day Modal
Opens as a centered modal (desktop) or bottom drawer (mobile).

Contents:
1. **Date heading** — e.g. "Wednesday, Jun 10"
2. **Training types** — multi-select tag chips. Clicking a chip toggles it. "+" opens an inline input to create a new tag on the fly (auto-assigns next color).
3. **Label** — single-line text input. Shown on the calendar day cell.
4. **Detailed note** — `MarkdownEditor` component (edit/preview toggle). A distinct content indicator appears on the calendar cell when this field is non-empty.
5. **Save button** — writes to Firestore. Modal closes on save.

### Stats (`/stats`)
Placeholder screen. Shows "Coming soon" with the nav shell intact.

### Settings (`/settings`)
Two sections:

**Global Note:**
- `MarkdownEditor` component. Auto-saves on blur (debounced).

**Training Types:**
- List of active tags: color swatch + name + delete button.
- Soft-delete on removal (existing day logs preserve the color).
- "Add training type" input: type name → Enter to create (auto-assigns color).
- Color swatch is clickable to cycle through Gruvbox accent colors.

### Sidebar / Navigation
Three items: **Calendar**, **Stats**, **Settings**.

Desktop: vertical left rail, always visible, shows icon + label.
Mobile: horizontal bottom tab bar, icons only.

---

## `MarkdownEditor` Component

Shared across Day Modal and Settings (global note). Two modes:
- **Edit mode:** plain `<textarea>` with monospace font.
- **Preview mode:** rendered markdown (use a lightweight library like `marked` or `micromark`).

Toggle button switches between modes. No live split-view (keeps the UI simple and mobile-friendly).

---

## Auth Flow

1. App loads → `+layout.svelte` checks auth state via Firebase `onAuthStateChanged`.
2. If unauthenticated → redirect to `/login`.
3. `/login` → Google Sign-In popup → on success, redirect to `/`.
4. All Firestore reads/writes use the authenticated `userId` as the collection root.
5. Firestore security rules enforce that users can only read/write their own data.

---

## Firestore Security Rules (outline)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Out of Scope (for this phase)

- Stats screen implementation (placeholder only)
- Offline support / PWA
- Data export
- Sharing or multi-user access
