# Fitness Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first SvelteKit SPA for personal training tracking with Firebase Auth, Firestore data storage, and a Gruvbox Dark UI.

**Architecture:** Pure client-side SvelteKit app (adapter-static, no SSR) where Svelte writable stores sync with Firestore and act as the single source of truth for UI state. Components read from stores; user actions write through store functions that call Firestore directly. Auth guard in `+layout.svelte` redirects unauthenticated users to `/login`.

**Tech Stack:** SvelteKit + TypeScript, Tailwind CSS, Firebase v9 (modular API), `marked` for markdown rendering, `@tailwindcss/typography` for prose styles, Vitest + @testing-library/svelte for unit/component tests.

## Global Constraints

- SvelteKit `adapter-static` with `fallback: 'index.html'` — pure SPA, no SSR, no prerender
- All Firebase env vars use `PUBLIC_` prefix (SvelteKit client-exposed convention)
- Gruvbox Dark palette only — no colors outside the defined palette except structural Tailwind utilities (flex, grid, padding, etc.)
- All Firestore data lives under `users/{userId}/` — no shared collections
- Mobile-first: sidebar on desktop (md+), bottom tab bar on mobile
- Both global note and day note are markdown (edit + preview toggle)
- Tag deletion is soft-delete: `deleted: true` hides from picker but logged days preserve color

---

## File Map

| File | Responsibility |
|---|---|
| `src/lib/types.ts` | Shared TypeScript types: `TrainingTag`, `DayEntry`, `GruvboxColor` |
| `src/lib/gruvbox.ts` | Color hex map + `nextColor()` auto-assignment logic |
| `src/lib/firebase.ts` | Firebase app init; exports `auth` and `db` |
| `src/lib/stores/auth.ts` | Auth state store + `signInWithGoogle`, `signOut` helpers |
| `src/lib/stores/tags.ts` | Training tags: Firestore-synced writable + CRUD functions |
| `src/lib/stores/days.ts` | Day entries: month-scoped Firestore subscription + save |
| `src/lib/stores/note.ts` | Global notepad: Firestore-synced writable + save |
| `src/lib/components/TagChip.svelte` | Colored toggleable tag pill |
| `src/lib/components/MarkdownEditor.svelte` | Edit/preview toggle markdown editor |
| `src/lib/components/Sidebar.svelte` | Desktop left rail + mobile bottom tab bar |
| `src/lib/components/Calendar.svelte` | Month grid with tag dots, label, note indicator |
| `src/lib/components/DayModal.svelte` | Day detail: tags, label, markdown note, save |
| `src/routes/+layout.ts` | Disable SSR + prerender |
| `src/routes/+layout.svelte` | Auth guard + app shell with Sidebar |
| `src/routes/+page.svelte` | Main view: Calendar + global notepad |
| `src/routes/login/+page.svelte` | Google Sign-In page |
| `src/routes/stats/+page.svelte` | Stats placeholder |
| `src/routes/settings/+page.svelte` | Tag management + global note editor |
| `firestore.rules` | Per-user Firestore security rules |
| `.env.example` | Firebase config env var template |

---

### Task 1: Project Scaffold

**Files:**
- Create: `svelte.config.js`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`
- Create: `src/app.html`, `src/app.css`, `src/test-setup.ts`
- Create: `src/routes/+layout.ts`
- Create: `.env.example`, `firestore.rules`

**Interfaces:**
- Produces: working SvelteKit dev server at `localhost:5173`, Tailwind with Gruvbox palette, Vitest configured with jsdom

- [ ] **Step 1: Initialize SvelteKit project**

```bash
npm create svelte@latest .
```

When prompted:
- Template: **Skeleton project**
- Type checking: **TypeScript**
- ESLint: **yes**
- Prettier: **yes**
- Playwright: **no**
- Vitest: **yes**

- [ ] **Step 2: Install dependencies**

```bash
npm install firebase marked
npm install -D @sveltejs/adapter-static tailwindcss postcss autoprefixer \
  @tailwindcss/typography @testing-library/svelte @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure adapter-static**

Replace `svelte.config.js`:
```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    })
  }
};

export default config;
```

- [ ] **Step 4: Initialize Tailwind**

```bash
npx tailwindcss init -p
```

Replace `tailwind.config.js`:
```javascript
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        gb: {
          bg:     '#282828',
          bg1:    '#3c3836',
          bg2:    '#504945',
          bg3:    '#665c54',
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
        }
      }
    }
  },
  plugins: [typography]
};
```

- [ ] **Step 5: Set up global styles**

Replace `src/app.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body {
    @apply bg-gb-bg text-gb-fg min-h-screen;
  }
}
```

- [ ] **Step 6: Disable SSR**

Create `src/routes/+layout.ts`:
```typescript
export const ssr = false;
export const prerender = false;
```

- [ ] **Step 7: Configure Vitest for Svelte components**

Replace `vite.config.ts`:
```typescript
import { sveltekit } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    globals: true
  }
});
```

Create `src/test-setup.ts`:
```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 8: Create env template and Firestore rules**

Create `.env.example`:
```
PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_AUTH_DOMAIN=
PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_STORAGE_BUCKET=
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
PUBLIC_FIREBASE_APP_ID=
```

Create `firestore.rules`:
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

- [ ] **Step 9: Create starter layout**

Create `src/routes/+layout.svelte`:
```svelte
<script lang="ts">
  import '../app.css';
</script>
<slot />
```

- [ ] **Step 10: Verify dev server starts**

```bash
npm run dev
```

Expected: Server at `http://localhost:5173` with no errors.

- [ ] **Step 11: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold SvelteKit SPA with Tailwind Gruvbox + Firebase deps"
```

---

### Task 2: Shared Types + Gruvbox Utilities

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/gruvbox.ts`
- Create: `src/lib/gruvbox.test.ts`

**Interfaces:**
- Produces:
  - `GruvboxColor` — union type of 7 color names
  - `TrainingTag` — `{ id: string; name: string; color: GruvboxColor; deleted: boolean }`
  - `DayEntry` — `{ tags: string[]; label: string; note: string }`
  - `GRUVBOX_COLORS: Record<GruvboxColor, string>` — hex values
  - `COLOR_ORDER: GruvboxColor[]` — assignment order
  - `nextColor(usedColors: GruvboxColor[]): GruvboxColor`

- [ ] **Step 1: Write failing tests for nextColor**

Create `src/lib/gruvbox.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { nextColor } from './gruvbox';
import type { GruvboxColor } from './types';

describe('nextColor', () => {
  it('returns red when no colors are used', () => {
    expect(nextColor([])).toBe('red');
  });

  it('skips used colors', () => {
    expect(nextColor(['red'])).toBe('green');
    expect(nextColor(['red', 'green'])).toBe('yellow');
  });

  it('cycles from the start when all 7 colors are in use', () => {
    const all: GruvboxColor[] = ['red', 'green', 'yellow', 'blue', 'purple', 'aqua', 'orange'];
    expect(nextColor(all)).toBe('red');
  });

  it('cycles by count: 8 used maps to index 1 (green)', () => {
    const eight: GruvboxColor[] = ['red', 'green', 'yellow', 'blue', 'purple', 'aqua', 'orange', 'red'];
    expect(nextColor(eight)).toBe('green');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/lib/gruvbox.test.ts
```

Expected: FAIL — `Cannot find module './gruvbox'`

- [ ] **Step 3: Create types.ts**

Create `src/lib/types.ts`:
```typescript
export type GruvboxColor = 'red' | 'green' | 'yellow' | 'blue' | 'purple' | 'aqua' | 'orange';

export interface TrainingTag {
  id: string;
  name: string;
  color: GruvboxColor;
  deleted: boolean;
}

export interface DayEntry {
  tags: string[];
  label: string;
  note: string;
}
```

- [ ] **Step 4: Create gruvbox.ts**

Create `src/lib/gruvbox.ts`:
```typescript
import type { GruvboxColor } from './types';

export const GRUVBOX_COLORS: Record<GruvboxColor, string> = {
  red:    '#fb4934',
  green:  '#b8bb26',
  yellow: '#fabd2f',
  blue:   '#83a598',
  purple: '#d3869b',
  aqua:   '#8ec07c',
  orange: '#fe8019',
};

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

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/gruvbox.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/gruvbox.ts src/lib/gruvbox.test.ts
git commit -m "feat: shared types and Gruvbox color utilities with nextColor"
```

---

### Task 3: Firebase Init + Auth Store + Login Page + Auth Guard

**Files:**
- Create: `src/lib/firebase.ts`
- Create: `src/lib/stores/auth.ts`
- Create: `src/lib/stores/auth.test.ts`
- Create: `src/routes/login/+page.svelte`
- Modify: `src/routes/+layout.svelte`

**Interfaces:**
- Consumes: `.env.local` with `PUBLIC_FIREBASE_*` vars
- Produces:
  - `auth` — Firebase Auth instance (re-exported from `$lib/firebase`)
  - `db` — Firestore instance (re-exported from `$lib/firebase`)
  - `user` — `Readable<User | null>`
  - `signInWithGoogle(): Promise<void>`
  - `signOut(): Promise<void>`

- [ ] **Step 1: Write failing auth store tests**

Create `src/lib/stores/auth.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/firebase', () => ({
  auth: {},
  db: {}
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({})),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

describe('auth store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes with null user when not signed in', async () => {
    const { onAuthStateChanged } = await import('firebase/auth');
    (onAuthStateChanged as ReturnType<typeof vi.fn>).mockImplementation((_auth, cb) => {
      cb(null);
      return () => {};
    });
    const { user } = await import('./auth');
    expect(get(user)).toBeNull();
  });

  it('updates user store when auth state changes to a user', async () => {
    const mockUser = { uid: 'abc123', email: 'test@example.com' };
    const { onAuthStateChanged } = await import('firebase/auth');
    (onAuthStateChanged as ReturnType<typeof vi.fn>).mockImplementation((_auth, cb) => {
      cb(mockUser);
      return () => {};
    });
    const { user } = await import('./auth');
    expect(get(user)).toEqual(mockUser);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/lib/stores/auth.test.ts
```

Expected: FAIL — `Cannot find module '$lib/firebase'`

- [ ] **Step 3: Create firebase.ts**

Create `src/lib/firebase.ts`:
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import {
  PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_AUTH_DOMAIN,
  PUBLIC_FIREBASE_PROJECT_ID,
  PUBLIC_FIREBASE_STORAGE_BUCKET,
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  PUBLIC_FIREBASE_APP_ID,
} from '$env/static/public';

const app = initializeApp({
  apiKey:            PUBLIC_FIREBASE_API_KEY,
  authDomain:        PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             PUBLIC_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
```

- [ ] **Step 4: Create auth store**

Create `src/lib/stores/auth.ts`:
```typescript
import { writable } from 'svelte/store';
import { auth } from '$lib/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

export const user = writable<User | null>(null);

onAuthStateChanged(auth, (u) => user.set(u));

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/stores/auth.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 6: Create login page**

Create `src/routes/login/+page.svelte`:
```svelte
<script lang="ts">
  import { signInWithGoogle, user } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    return user.subscribe((u) => { if (u) goto('/'); });
  });

  async function handleSignIn() {
    await signInWithGoogle();
    goto('/');
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gb-bg">
  <div class="bg-gb-bg1 rounded-lg p-10 flex flex-col items-center gap-6 shadow-xl">
    <h1 class="text-gb-yellow text-3xl font-bold tracking-wide">Fitness Tracker</h1>
    <p class="text-gb-fg3 text-sm">Track your training progress</p>
    <button
      on:click={handleSignIn}
      class="bg-gb-blue text-gb-bg font-semibold px-6 py-3 rounded-md hover:opacity-90 transition"
    >
      Sign in with Google
    </button>
  </div>
</div>
```

- [ ] **Step 7: Update layout with auth guard**

Replace `src/routes/+layout.svelte`:
```svelte
<script lang="ts">
  import '../app.css';
  import { user } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';

  onMount(() => {
    return user.subscribe((u) => {
      if (u === null && $page.url.pathname !== '/login') goto('/login');
    });
  });

  $: showShell = $page.url.pathname !== '/login';
</script>

{#if showShell}
  <div class="flex min-h-screen">
    <Sidebar />
    <main class="flex-1 overflow-y-auto pb-20 md:pb-0">
      <slot />
    </main>
  </div>
{:else}
  <slot />
{/if}
```

Note: `Sidebar` is imported here but built in Task 9. For now the layout will fail to compile until Task 9 is done — create a temporary stub `src/lib/components/Sidebar.svelte` with just `<div />` to unblock the build.

- [ ] **Step 8: Create temporary Sidebar stub**

Create `src/lib/components/Sidebar.svelte`:
```svelte
<div />
```

- [ ] **Step 9: Copy .env.example to .env.local and fill in values**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Firebase project credentials from the Firebase console.

- [ ] **Step 10: Verify login page renders**

```bash
npm run dev
```

Navigate to `http://localhost:5173` — should redirect to `/login` showing the sign-in card.

- [ ] **Step 11: Commit**

```bash
git add src/lib/firebase.ts src/lib/stores/auth.ts src/lib/stores/auth.test.ts \
  src/routes/login/+page.svelte src/routes/+layout.svelte \
  src/lib/components/Sidebar.svelte .env.example firestore.rules
git commit -m "feat: Firebase init, auth store, login page, auth guard layout"
```

---

### Task 4: Tags Store

**Files:**
- Create: `src/lib/stores/tags.ts`
- Create: `src/lib/stores/tags.test.ts`

**Interfaces:**
- Consumes: `db` from `$lib/firebase`, `TrainingTag`, `GruvboxColor` from `$lib/types`, `nextColor` from `$lib/gruvbox`
- Produces:
  - `tags` — `Readable<TrainingTag[]>` (all tags including deleted — for resolving calendar colors)
  - `activeTags` — `Readable<TrainingTag[]>` (deleted: false only — for picker)
  - `initTags(userId: string): () => void` — sets up Firestore listener, returns unsubscribe
  - `addTag(userId: string, name: string): Promise<void>`
  - `deleteTag(userId: string, tagId: string): Promise<void>` — soft-delete
  - `updateTagColor(userId: string, tagId: string, color: GruvboxColor): Promise<void>`

- [ ] **Step 1: Write failing tests**

Create `src/lib/stores/tags.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

const mockOnSnapshot = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn(() => ({}));
const mockCollection = vi.fn(() => ({}));
const mockQuery = vi.fn((ref) => ref);

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('$lib/gruvbox', () => ({
  nextColor: vi.fn(() => 'red'),
  COLOR_ORDER: ['red', 'green', 'yellow', 'blue', 'purple', 'aqua', 'orange'],
}));
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  onSnapshot: mockOnSnapshot,
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  doc: mockDoc,
  query: mockQuery,
}));

describe('tags store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty array', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { tags } = await import('./tags');
    expect(get(tags)).toEqual([]);
  });

  it('populates tags from Firestore snapshot', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => {
      cb({ docs: [{ id: 'tag1', data: () => ({ name: 'Weight Lifting', color: 'blue', deleted: false }) }] });
      return () => {};
    });
    const { tags, initTags } = await import('./tags');
    initTags('user1');
    expect(get(tags)).toEqual([{ id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false }]);
  });

  it('activeTags excludes deleted tags', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => {
      cb({
        docs: [
          { id: 'tag1', data: () => ({ name: 'Boxing', color: 'red', deleted: false }) },
          { id: 'tag2', data: () => ({ name: 'Old', color: 'gray', deleted: true }) },
        ]
      });
      return () => {};
    });
    const { activeTags, initTags } = await import('./tags');
    initTags('user1');
    expect(get(activeTags).length).toBe(1);
    expect(get(activeTags)[0].name).toBe('Boxing');
  });

  it('addTag calls addDoc with auto-assigned color', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { addTag } = await import('./tags');
    await addTag('user1', 'Boxing');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'Boxing', color: 'red', deleted: false })
    );
  });

  it('deleteTag calls updateDoc with deleted: true', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { deleteTag } = await import('./tags');
    await deleteTag('user1', 'tag1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { deleted: true });
  });

  it('updateTagColor calls updateDoc with new color', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { updateTagColor } = await import('./tags');
    await updateTagColor('user1', 'tag1', 'purple');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { color: 'purple' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/lib/stores/tags.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement tags store**

Create `src/lib/stores/tags.ts`:
```typescript
import { writable, derived } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query } from 'firebase/firestore';
import { nextColor } from '$lib/gruvbox';
import type { TrainingTag, GruvboxColor } from '$lib/types';

const _tags = writable<TrainingTag[]>([]);

export const tags = { subscribe: _tags.subscribe };
export const activeTags = derived(_tags, ($t) => $t.filter((t) => !t.deleted));

export function initTags(userId: string): () => void {
  const q = query(collection(db, 'users', userId, 'tags'));
  return onSnapshot(q, (snap) => {
    _tags.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TrainingTag, 'id'>) })));
  });
}

export async function addTag(userId: string, name: string): Promise<void> {
  const current = await new Promise<TrainingTag[]>((resolve) => {
    const unsub = _tags.subscribe((v) => { resolve(v); unsub(); });
  });
  const color = nextColor(current.filter((t) => !t.deleted).map((t) => t.color));
  await addDoc(collection(db, 'users', userId, 'tags'), { name, color, deleted: false });
}

export async function deleteTag(userId: string, tagId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'tags', tagId), { deleted: true });
}

export async function updateTagColor(userId: string, tagId: string, color: GruvboxColor): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'tags', tagId), { color });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/stores/tags.test.ts
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/tags.ts src/lib/stores/tags.test.ts
git commit -m "feat: tags store with Firestore sync, auto-color, and soft-delete"
```

---

### Task 5: Days Store

**Files:**
- Create: `src/lib/stores/days.ts`
- Create: `src/lib/stores/days.test.ts`

**Interfaces:**
- Consumes: `db` from `$lib/firebase`, `DayEntry` from `$lib/types`
- Produces:
  - `days` — `Readable<Record<string, DayEntry>>` keyed by `YYYY-MM-DD`
  - `initDays(userId: string, year: number, month: number): () => void`
  - `saveDay(userId: string, dateKey: string, entry: DayEntry): Promise<void>`

- [ ] **Step 1: Write failing tests**

Create `src/lib/stores/days.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn(() => ({}));
const mockCollection = vi.fn(() => ({}));
const mockQuery = vi.fn((ref) => ref);
const mockWhere = vi.fn();
const mockDocumentId = vi.fn(() => '__name__');

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  query: mockQuery,
  where: mockWhere,
  documentId: mockDocumentId,
}));

describe('days store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty object', async () => {
    const { days } = await import('./days');
    expect(get(days)).toEqual({});
  });

  it('populates days from Firestore snapshot', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => {
      cb({ docs: [{ id: '2026-06-10', data: () => ({ tags: ['tag1'], label: 'Leg day', note: '# PR' }) }] });
      return () => {};
    });
    const { days, initDays } = await import('./days');
    initDays('user1', 2026, 6);
    expect(get(days)['2026-06-10']).toEqual({ tags: ['tag1'], label: 'Leg day', note: '# PR' });
  });

  it('saveDay calls setDoc with correct path and data', async () => {
    mockOnSnapshot.mockImplementation((_q, cb) => { cb({ docs: [] }); return () => {}; });
    const { saveDay } = await import('./days');
    const entry = { tags: ['tag1'], label: 'Push day', note: '' };
    await saveDay('user1', '2026-06-10', entry);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), entry, { merge: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/lib/stores/days.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement days store**

Create `src/lib/stores/days.ts`:
```typescript
import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, doc, onSnapshot, setDoc, query, where, documentId } from 'firebase/firestore';
import type { DayEntry } from '$lib/types';

const _days = writable<Record<string, DayEntry>>({});

export const days = { subscribe: _days.subscribe };

export function initDays(userId: string, year: number, month: number): () => void {
  const m = String(month).padStart(2, '0');
  const q = query(
    collection(db, 'users', userId, 'days'),
    where(documentId(), '>=', `${year}-${m}-01`),
    where(documentId(), '<=', `${year}-${m}-31`)
  );
  return onSnapshot(q, (snap) => {
    const entries: Record<string, DayEntry> = {};
    snap.docs.forEach((d) => { entries[d.id] = d.data() as DayEntry; });
    _days.set(entries);
  });
}

export async function saveDay(userId: string, dateKey: string, entry: DayEntry): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'days', dateKey), entry, { merge: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/stores/days.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/days.ts src/lib/stores/days.test.ts
git commit -m "feat: days store with month-scoped Firestore subscription"
```

---

### Task 6: Global Note Store

**Files:**
- Create: `src/lib/stores/note.ts`
- Create: `src/lib/stores/note.test.ts`

**Interfaces:**
- Consumes: `db` from `$lib/firebase`
- Produces:
  - `globalNote` — `Writable<string>` (two-way bindable)
  - `initNote(userId: string): () => void`
  - `saveNote(userId: string, content: string): Promise<void>`

- [ ] **Step 1: Write failing tests**

Create `src/lib/stores/note.test.ts`:
```typescript
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

describe('note store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initializes as empty string', async () => {
    const { globalNote } = await import('./note');
    expect(get(globalNote)).toBe('');
  });

  it('populates from Firestore when doc exists', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ exists: () => true, data: () => ({ globalNote: '## June Program' }) });
      return () => {};
    });
    const { globalNote, initNote } = await import('./note');
    initNote('user1');
    expect(get(globalNote)).toBe('## June Program');
  });

  it('stays empty when Firestore doc does not exist', async () => {
    mockOnSnapshot.mockImplementation((_ref, cb) => {
      cb({ exists: () => false });
      return () => {};
    });
    const { globalNote, initNote } = await import('./note');
    initNote('user1');
    expect(get(globalNote)).toBe('');
  });

  it('saveNote calls setDoc with merge', async () => {
    mockOnSnapshot.mockImplementation((_r, cb) => { cb({ exists: () => false }); return () => {}; });
    const { saveNote } = await import('./note');
    await saveNote('user1', '## My Note');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { globalNote: '## My Note' },
      { merge: true }
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/lib/stores/note.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement note store**

Create `src/lib/stores/note.ts`:
```typescript
import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export const globalNote = writable<string>('');

export function initNote(userId: string): () => void {
  return onSnapshot(doc(db, 'users', userId, 'meta'), (snap) => {
    globalNote.set(snap.exists() ? (snap.data()?.globalNote ?? '') : '');
  });
}

export async function saveNote(userId: string, content: string): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'meta'), { globalNote: content }, { merge: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/stores/note.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/note.ts src/lib/stores/note.test.ts
git commit -m "feat: global note store with Firestore sync"
```

---

### Task 7: TagChip Component

**Files:**
- Create: `src/lib/components/TagChip.svelte`
- Create: `src/lib/components/TagChip.test.ts`

**Interfaces:**
- Consumes: `TrainingTag` from `$lib/types`, `GRUVBOX_COLORS` from `$lib/gruvbox`
- Produces: `<TagChip {tag} {selected} on:toggle />` — emits `toggle` with `detail: string` (tagId) on click; selected=true renders filled background, false renders outlined

- [ ] **Step 1: Write failing tests**

Create `src/lib/components/TagChip.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TagChip from './TagChip.svelte';
import type { TrainingTag } from '$lib/types';

const tag: TrainingTag = { id: 'tag1', name: 'Boxing', color: 'red', deleted: false };

describe('TagChip', () => {
  it('renders tag name', () => {
    const { getByText } = render(TagChip, { props: { tag, selected: false } });
    expect(getByText('Boxing')).toBeInTheDocument();
  });

  it('applies background color when selected', () => {
    const { getByText } = render(TagChip, { props: { tag, selected: true } });
    const el = getByText('Boxing');
    expect(el.style.backgroundColor).toBe('rgb(251, 73, 52)');
  });

  it('has transparent background when not selected', () => {
    const { getByText } = render(TagChip, { props: { tag, selected: false } });
    const el = getByText('Boxing');
    expect(el.style.backgroundColor).toBe('transparent');
  });

  it('emits toggle event with tagId on click', async () => {
    const handler = vi.fn();
    const { getByText, component } = render(TagChip, { props: { tag, selected: false } });
    component.$on('toggle', handler);
    await fireEvent.click(getByText('Boxing'));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toBe('tag1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/lib/components/TagChip.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement TagChip**

Replace `src/lib/components/TagChip.svelte` (was a stub):
```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { GRUVBOX_COLORS } from '$lib/gruvbox';
  import type { TrainingTag } from '$lib/types';

  export let tag: TrainingTag;
  export let selected: boolean = false;

  const dispatch = createEventDispatcher<{ toggle: string }>();

  $: hex = GRUVBOX_COLORS[tag.color];
</script>

<button
  type="button"
  on:click={() => dispatch('toggle', tag.id)}
  style="background-color: {selected ? hex : 'transparent'}; border-color: {hex}; color: {selected ? '#282828' : hex};"
  class="px-3 py-1 rounded-full border text-sm font-medium transition-colors cursor-pointer"
>
  {tag.name}
</button>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/components/TagChip.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/TagChip.svelte src/lib/components/TagChip.test.ts
git commit -m "feat: TagChip component with Gruvbox colors and toggle event"
```

---

### Task 8: MarkdownEditor Component

**Files:**
- Create: `src/lib/components/MarkdownEditor.svelte`
- Create: `src/lib/components/MarkdownEditor.test.ts`

**Interfaces:**
- Consumes: `marked` library
- Produces: `<MarkdownEditor bind:value={string} placeholder={string} />` — edit mode shows textarea; preview mode shows rendered HTML; toggle button switches between modes

- [ ] **Step 1: Write failing tests**

Create `src/lib/components/MarkdownEditor.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MarkdownEditor from './MarkdownEditor.svelte';

vi.mock('marked', () => ({ marked: (s: string) => `<p>${s}</p>` }));

describe('MarkdownEditor', () => {
  it('renders textarea in edit mode by default', () => {
    const { getByRole } = render(MarkdownEditor, { props: { value: '', placeholder: 'Write...' } });
    expect(getByRole('textbox')).toBeInTheDocument();
  });

  it('shows placeholder in textarea', () => {
    const { getByPlaceholderText } = render(MarkdownEditor, {
      props: { value: '', placeholder: 'Write here' }
    });
    expect(getByPlaceholderText('Write here')).toBeInTheDocument();
  });

  it('switches to preview mode on toggle click', async () => {
    const { getByText, queryByRole } = render(MarkdownEditor, {
      props: { value: '**bold**', placeholder: '' }
    });
    await fireEvent.click(getByText('Preview'));
    expect(queryByRole('textbox')).not.toBeInTheDocument();
    expect(getByText('Edit')).toBeInTheDocument();
  });

  it('renders markdown HTML in preview mode', async () => {
    const { getByText, container } = render(MarkdownEditor, {
      props: { value: '**hello**', placeholder: '' }
    });
    await fireEvent.click(getByText('Preview'));
    expect(container.querySelector('p')).toBeInTheDocument();
  });

  it('switches back to edit mode', async () => {
    const { getByText, getByRole } = render(MarkdownEditor, {
      props: { value: '', placeholder: '' }
    });
    await fireEvent.click(getByText('Preview'));
    await fireEvent.click(getByText('Edit'));
    expect(getByRole('textbox')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/lib/components/MarkdownEditor.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement MarkdownEditor**

Create `src/lib/components/MarkdownEditor.svelte`:
```svelte
<script lang="ts">
  import { marked } from 'marked';

  export let value: string = '';
  export let placeholder: string = '';

  let mode: 'edit' | 'preview' = 'edit';

  $: rendered = marked(value) as string;
</script>

<div class="flex flex-col gap-2">
  <div class="flex justify-end">
    <button
      type="button"
      on:click={() => (mode = mode === 'edit' ? 'preview' : 'edit')}
      class="text-xs text-gb-blue hover:text-gb-fg transition px-2 py-1 rounded bg-gb-bg2"
    >
      {mode === 'edit' ? 'Preview' : 'Edit'}
    </button>
  </div>

  {#if mode === 'edit'}
    <textarea
      bind:value
      {placeholder}
      rows="6"
      class="w-full bg-gb-bg2 text-gb-fg font-mono text-sm rounded-md p-3 resize-y
             border border-gb-bg3 focus:outline-none focus:border-gb-blue"
    />
  {:else}
    <div
      class="prose prose-invert max-w-none min-h-[8rem] bg-gb-bg2 rounded-md p-3
             text-gb-fg text-sm [&_h1]:text-gb-yellow [&_h2]:text-gb-yellow
             [&_h3]:text-gb-yellow [&_strong]:text-gb-orange [&_a]:text-gb-blue"
    >
      {@html rendered}
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/components/MarkdownEditor.test.ts
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/MarkdownEditor.svelte src/lib/components/MarkdownEditor.test.ts
git commit -m "feat: MarkdownEditor component with edit/preview toggle"
```

---

### Task 9: Sidebar Component

**Files:**
- Modify: `src/lib/components/Sidebar.svelte` (replace the stub from Task 3)
- Create: `src/lib/components/Sidebar.test.ts`

**Interfaces:**
- Consumes: `$app/stores` page store for active route detection
- Produces: `<Sidebar />` — desktop left rail (hidden on mobile), mobile bottom tab bar (visible on mobile only). Three links: Calendar `/`, Stats `/stats`, Settings `/settings`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/components/Sidebar.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Sidebar from './Sidebar.svelte';

vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn((cb) => {
      cb({ url: { pathname: '/' } });
      return () => {};
    })
  }
}));

describe('Sidebar', () => {
  it('renders Calendar, Stats, and Settings links', () => {
    const { getAllByText } = render(Sidebar);
    // Text appears twice: desktop + mobile nav
    expect(getAllByText('Calendar').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Stats').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
  });

  it('links point to correct hrefs', () => {
    const { container } = render(Sidebar);
    const links = container.querySelectorAll('a[href]');
    const hrefs = [...links].map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/stats');
    expect(hrefs).toContain('/settings');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/lib/components/Sidebar.test.ts
```

Expected: FAIL (stub `<div />` has no links)

- [ ] **Step 3: Implement Sidebar**

Replace `src/lib/components/Sidebar.svelte`:
```svelte
<script lang="ts">
  import { page } from '$app/stores';

  const nav = [
    { href: '/',         label: 'Calendar', icon: '📅' },
    { href: '/stats',    label: 'Stats',    icon: '📊' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  $: path = $page.url.pathname;
</script>

<!-- Desktop left rail -->
<nav class="hidden md:flex flex-col w-52 min-h-screen bg-gb-bg1 border-r border-gb-bg2 p-4 gap-1 shrink-0">
  <div class="text-gb-yellow font-bold text-lg mb-6 px-2">Fitness Tracker</div>
  {#each nav as item}
    <a
      href={item.href}
      class="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
             {path === item.href
               ? 'bg-gb-bg2 text-gb-yellow font-semibold'
               : 'text-gb-fg2 hover:text-gb-fg hover:bg-gb-bg2'}"
    >
      <span class="text-base">{item.icon}</span>
      {item.label}
    </a>
  {/each}
</nav>

<!-- Mobile bottom tab bar -->
<nav class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gb-bg1 border-t border-gb-bg2 flex">
  {#each nav as item}
    <a
      href={item.href}
      class="flex flex-1 flex-col items-center gap-0.5 py-3 text-xs transition-colors
             {path === item.href ? 'text-gb-yellow' : 'text-gb-fg3'}"
    >
      <span class="text-xl leading-none">{item.icon}</span>
      {item.label}
    </a>
  {/each}
</nav>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/components/Sidebar.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Sidebar.svelte src/lib/components/Sidebar.test.ts
git commit -m "feat: Sidebar component with desktop rail and mobile bottom tab bar"
```

---

### Task 10: Calendar Component

**Files:**
- Create: `src/lib/components/Calendar.svelte`
- Create: `src/lib/components/Calendar.test.ts`

**Interfaces:**
- Consumes: `DayEntry`, `TrainingTag` from `$lib/types`, `GRUVBOX_COLORS` from `$lib/gruvbox`
- Produces:
  - `<Calendar {year} {month} {days} {tags} on:selectDay on:prevMonth on:nextMonth />`
  - `on:selectDay` — detail: `string` (YYYY-MM-DD)
  - `on:prevMonth` / `on:nextMonth` — no detail

- [ ] **Step 1: Write failing tests**

Create `src/lib/components/Calendar.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Calendar from './Calendar.svelte';
import type { TrainingTag, DayEntry } from '$lib/types';

const tags: TrainingTag[] = [
  { id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false },
];
const days: Record<string, DayEntry> = {
  '2026-06-10': { tags: ['tag1'], label: 'Leg day', note: '# PR' },
  '2026-06-15': { tags: [], label: '', note: 'Bodyweight: 74kg' },
};

describe('Calendar', () => {
  it('renders the month and year heading', () => {
    const { getByText } = render(Calendar, { props: { year: 2026, month: 6, days: {}, tags: [] } });
    expect(getByText(/june 2026/i)).toBeInTheDocument();
  });

  it('renders 30 day cells for June', () => {
    const { getAllByRole } = render(Calendar, { props: { year: 2026, month: 6, days: {}, tags: [] } });
    const dayButtons = getAllByRole('button').filter((b) => /^\d+$/.test(b.textContent?.trim() ?? ''));
    expect(dayButtons.length).toBe(30);
  });

  it('emits selectDay with YYYY-MM-DD on day click', async () => {
    const handler = vi.fn();
    const { getAllByRole, component } = render(Calendar, {
      props: { year: 2026, month: 6, days: {}, tags: [] }
    });
    component.$on('selectDay', handler);
    const btn = getAllByRole('button').find((b) => b.textContent?.trim() === '10');
    await fireEvent.click(btn!);
    expect(handler.mock.calls[0][0].detail).toBe('2026-06-10');
  });

  it('shows label text for a day that has one', () => {
    const { getByText } = render(Calendar, { props: { year: 2026, month: 6, days, tags } });
    expect(getByText('Leg day')).toBeInTheDocument();
  });

  it('shows note indicator for days with a non-empty note', () => {
    const { container } = render(Calendar, { props: { year: 2026, month: 6, days, tags } });
    const indicators = container.querySelectorAll('[data-has-note]');
    expect(indicators.length).toBe(2);
  });

  it('emits prevMonth on left arrow click', async () => {
    const handler = vi.fn();
    const { getByLabelText, component } = render(Calendar, {
      props: { year: 2026, month: 6, days: {}, tags: [] }
    });
    component.$on('prevMonth', handler);
    await fireEvent.click(getByLabelText('Previous month'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('emits nextMonth on right arrow click', async () => {
    const handler = vi.fn();
    const { getByLabelText, component } = render(Calendar, {
      props: { year: 2026, month: 6, days: {}, tags: [] }
    });
    component.$on('nextMonth', handler);
    await fireEvent.click(getByLabelText('Next month'));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/lib/components/Calendar.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement Calendar**

Create `src/lib/components/Calendar.svelte`:
```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { GRUVBOX_COLORS } from '$lib/gruvbox';
  import type { TrainingTag, DayEntry } from '$lib/types';

  export let year: number;
  export let month: number; // 1–12
  export let days: Record<string, DayEntry> = {};
  export let tags: TrainingTag[] = [];

  const dispatch = createEventDispatcher<{ selectDay: string; prevMonth: void; nextMonth: void }>();

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DAY_HEADERS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

  $: tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));

  $: gridCells = (() => {
    const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const leading = (firstDow + 6) % 7; // shift so Mon=0
    const count = new Date(year, month, 0).getDate();
    return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)] as (number | null)[];
  })();

  function key(d: number) {
    return `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  function tagColors(d: number): string[] {
    return (days[key(d)]?.tags ?? [])
      .map((id) => tagMap[id])
      .filter(Boolean)
      .map((t) => GRUVBOX_COLORS[t.color]);
  }

  function label(d: number) { return days[key(d)]?.label ?? ''; }
  function hasNote(d: number) { return !!(days[key(d)]?.note); }
</script>

<div class="select-none">
  <div class="flex items-center justify-between mb-3 px-1">
    <button aria-label="Previous month" on:click={() => dispatch('prevMonth')}
      class="text-gb-fg2 hover:text-gb-fg px-2 py-1 rounded hover:bg-gb-bg2 transition text-xl leading-none">‹</button>
    <h2 class="text-gb-yellow font-semibold text-lg">{MONTHS[month - 1]} {year}</h2>
    <button aria-label="Next month" on:click={() => dispatch('nextMonth')}
      class="text-gb-fg2 hover:text-gb-fg px-2 py-1 rounded hover:bg-gb-bg2 transition text-xl leading-none">›</button>
  </div>

  <div class="grid grid-cols-7 mb-1">
    {#each DAY_HEADERS as h}
      <div class="text-center text-xs text-gb-gray font-medium py-1">{h}</div>
    {/each}
  </div>

  <div class="grid grid-cols-7 gap-px bg-gb-bg2 border border-gb-bg2 rounded-lg overflow-hidden">
    {#each gridCells as cell}
      {#if cell === null}
        <div class="bg-gb-bg min-h-[4.5rem]" />
      {:else}
        <button
          type="button"
          on:click={() => dispatch('selectDay', key(cell))}
          data-has-note={hasNote(cell) ? '' : undefined}
          class="bg-gb-bg hover:bg-gb-bg1 transition min-h-[4.5rem] p-1.5
                 flex flex-col items-start gap-0.5 text-left"
        >
          <div class="flex items-center gap-1">
            <span class="text-xs text-gb-fg2 font-medium leading-none">{cell}</span>
            {#if hasNote(cell)}
              <span class="w-1.5 h-1.5 rounded-full bg-gb-gray shrink-0" title="Has note" />
            {/if}
          </div>

          {#if label(cell)}
            <span class="text-[10px] text-gb-fg3 leading-tight truncate w-full">{label(cell)}</span>
          {/if}

          <div class="flex flex-wrap gap-0.5 mt-auto">
            {#each tagColors(cell) as color}
              <span class="w-2 h-2 rounded-full shrink-0" style="background-color:{color}" />
            {/each}
          </div>
        </button>
      {/if}
    {/each}
  </div>
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/components/Calendar.test.ts
```

Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Calendar.svelte src/lib/components/Calendar.test.ts
git commit -m "feat: Calendar component with tag dots, label, note indicator, month nav"
```

---

### Task 11: DayModal Component

**Files:**
- Create: `src/lib/components/DayModal.svelte`
- Create: `src/lib/components/DayModal.test.ts`

**Interfaces:**
- Consumes:
  - `TagChip` from `$lib/components/TagChip.svelte`
  - `MarkdownEditor` from `$lib/components/MarkdownEditor.svelte`
  - `saveDay(userId, dateKey, DayEntry)` from `$lib/stores/days`
  - `addTag(userId, name)` from `$lib/stores/tags`
  - `TrainingTag`, `DayEntry` from `$lib/types`
- Produces: `<DayModal {dateKey} {entry} {activeTags} {userId} on:close />` — emits `close` after save or on backdrop/X click

- [ ] **Step 1: Write failing tests**

Create `src/lib/components/DayModal.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DayModal from './DayModal.svelte';
import type { TrainingTag, DayEntry } from '$lib/types';

vi.mock('$lib/stores/days', () => ({ saveDay: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/stores/tags', () => ({ addTag: vi.fn().mockResolvedValue(undefined) }));
vi.mock('marked', () => ({ marked: (s: string) => s }));

const activeTags: TrainingTag[] = [
  { id: 'tag1', name: 'Weight Lifting', color: 'blue', deleted: false },
  { id: 'tag2', name: 'Boxing', color: 'red', deleted: false },
];
const entry: DayEntry = { tags: ['tag1'], label: 'Leg day', note: '# PR' };

describe('DayModal', () => {
  it('renders a formatted date heading', () => {
    const { getByText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByText(/june 10.*2026/i)).toBeInTheDocument();
  });

  it('renders all active tag chips', () => {
    const { getByText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByText('Weight Lifting')).toBeInTheDocument();
    expect(getByText('Boxing')).toBeInTheDocument();
  });

  it('pre-fills the label field', () => {
    const { getByDisplayValue } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    expect(getByDisplayValue('Leg day')).toBeInTheDocument();
  });

  it('calls saveDay with correct args on Save click', async () => {
    const { saveDay } = await import('$lib/stores/days');
    const { getByText } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    await fireEvent.click(getByText('Save'));
    expect(saveDay).toHaveBeenCalledWith('user1', '2026-06-10', expect.objectContaining({ label: 'Leg day' }));
  });

  it('emits close after save', async () => {
    const handler = vi.fn();
    const { getByText, component } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    component.$on('close', handler);
    await fireEvent.click(getByText('Save'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('emits close when X button clicked', async () => {
    const handler = vi.fn();
    const { getByLabelText, component } = render(DayModal, {
      props: { dateKey: '2026-06-10', entry, activeTags, userId: 'user1' }
    });
    component.$on('close', handler);
    await fireEvent.click(getByLabelText('Close'));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/lib/components/DayModal.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement DayModal**

Create `src/lib/components/DayModal.svelte`:
```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import TagChip from './TagChip.svelte';
  import MarkdownEditor from './MarkdownEditor.svelte';
  import { saveDay } from '$lib/stores/days';
  import { addTag } from '$lib/stores/tags';
  import type { TrainingTag, DayEntry } from '$lib/types';

  export let dateKey: string;      // YYYY-MM-DD
  export let entry: DayEntry;
  export let activeTags: TrainingTag[];
  export let userId: string;

  const dispatch = createEventDispatcher();

  let selectedIds = new Set<string>(entry.tags);
  let label = entry.label;
  let note = entry.note;
  let newTagName = '';
  let addingTag = false;

  $: [yr, mo, dy] = dateKey.split('-').map(Number);
  $: heading = new Date(yr, mo - 1, dy).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  function toggleTag(tagId: string) {
    if (selectedIds.has(tagId)) selectedIds.delete(tagId);
    else selectedIds.add(tagId);
    selectedIds = selectedIds;
  }

  async function commitNewTag() {
    if (!newTagName.trim()) { addingTag = false; return; }
    await addTag(userId, newTagName.trim());
    newTagName = '';
    addingTag = false;
  }

  async function handleSave() {
    await saveDay(userId, dateKey, { tags: [...selectedIds], label, note });
    dispatch('close');
  }
</script>

<div
  class="fixed inset-0 bg-black/60 z-40 flex items-end md:items-center justify-center"
  on:click|self={() => dispatch('close')}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <div class="bg-gb-bg1 w-full md:w-[520px] md:max-h-[85vh] overflow-y-auto
              rounded-t-2xl md:rounded-xl shadow-2xl p-6 flex flex-col gap-5">

    <div class="flex items-start justify-between">
      <h2 id="modal-title" class="text-gb-yellow font-semibold text-lg leading-tight">{heading}</h2>
      <button
        type="button"
        on:click={() => dispatch('close')}
        aria-label="Close"
        class="text-gb-fg3 hover:text-gb-fg text-2xl leading-none ml-4 shrink-0"
      >×</button>
    </div>

    <!-- Training types -->
    <div class="flex flex-col gap-2">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Training types</span>
      <div class="flex flex-wrap gap-2">
        {#each activeTags as tag (tag.id)}
          <TagChip {tag} selected={selectedIds.has(tag.id)} on:toggle={() => toggleTag(tag.id)} />
        {/each}

        {#if addingTag}
          <input
            type="text"
            bind:value={newTagName}
            placeholder="Type name…"
            on:keydown={(e) => e.key === 'Enter' && commitNewTag()}
            on:blur={commitNewTag}
            class="px-3 py-1 rounded-full border border-gb-bg3 bg-gb-bg2 text-gb-fg
                   text-sm focus:outline-none focus:border-gb-blue"
            autofocus
          />
        {:else}
          <button
            type="button"
            on:click={() => (addingTag = true)}
            class="px-3 py-1 rounded-full border border-gb-bg3 text-gb-fg3 text-sm
                   hover:border-gb-blue hover:text-gb-blue transition"
          >+ Add</button>
        {/if}
      </div>
    </div>

    <!-- Label -->
    <div class="flex flex-col gap-1">
      <label for="day-label" class="text-xs text-gb-fg3 uppercase tracking-wider">Label</label>
      <input
        id="day-label"
        type="text"
        bind:value={label}
        placeholder="Short label shown on calendar"
        class="w-full bg-gb-bg2 text-gb-fg text-sm rounded-md px-3 py-2
               border border-gb-bg3 focus:outline-none focus:border-gb-blue"
      />
    </div>

    <!-- Notes -->
    <div class="flex flex-col gap-1">
      <span class="text-xs text-gb-fg3 uppercase tracking-wider">Notes</span>
      <MarkdownEditor bind:value={note} placeholder="Bodyweight, PRs, observations…" />
    </div>

    <button
      type="button"
      on:click={handleSave}
      class="w-full bg-gb-green text-gb-bg font-semibold py-2.5 rounded-md
             hover:opacity-90 transition"
    >
      Save
    </button>
  </div>
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/lib/components/DayModal.test.ts
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/DayModal.svelte src/lib/components/DayModal.test.ts
git commit -m "feat: DayModal with tag selection, label, markdown note, and save"
```

---

### Task 12: Main Page (Calendar View)

**Files:**
- Modify: `src/routes/+page.svelte`

**Interfaces:**
- Consumes: all stores (`user`, `tags`, `activeTags`, `initTags`, `days`, `initDays`, `globalNote`, `initNote`, `saveNote`), `Calendar`, `DayModal`, `MarkdownEditor` components

- [ ] **Step 1: Implement main page**

Replace `src/routes/+page.svelte`:
```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { user } from '$lib/stores/auth';
  import { tags, activeTags, initTags } from '$lib/stores/tags';
  import { days, initDays } from '$lib/stores/days';
  import { globalNote, initNote, saveNote } from '$lib/stores/note';
  import Calendar from '$lib/components/Calendar.svelte';
  import DayModal from '$lib/components/DayModal.svelte';
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';

  let selectedDate: string | null = null;
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth() + 1;

  let unsubTags: (() => void) | null = null;
  let unsubDays: (() => void) | null = null;
  let unsubNote: (() => void) | null = null;

  $: userId = $user?.uid ?? '';

  $: if (userId) {
    unsubTags?.(); unsubTags = initTags(userId);
    unsubNote?.(); unsubNote = initNote(userId);
  }

  $: if (userId && (viewYear || viewMonth)) {
    unsubDays?.();
    unsubDays = initDays(userId, viewYear, viewMonth);
  }

  onDestroy(() => { unsubTags?.(); unsubDays?.(); unsubNote?.(); });

  function prevMonth() {
    if (viewMonth === 1) { viewMonth = 12; viewYear -= 1; }
    else viewMonth -= 1;
  }

  function nextMonth() {
    if (viewMonth === 12) { viewMonth = 1; viewYear += 1; }
    else viewMonth += 1;
  }

  $: selectedEntry = selectedDate
    ? ($days[selectedDate] ?? { tags: [], label: '', note: '' })
    : null;

  let noteSaveTimer: ReturnType<typeof setTimeout>;
  function scheduleNoteSave() {
    clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(() => { if (userId) saveNote(userId, $globalNote); }, 800);
  }
</script>

<div class="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-8">
  <Calendar
    year={viewYear}
    month={viewMonth}
    days={$days}
    tags={$tags}
    on:selectDay={(e) => (selectedDate = e.detail)}
    on:prevMonth={prevMonth}
    on:nextMonth={nextMonth}
  />

  <div class="flex flex-col gap-2" on:focusout={scheduleNoteSave}>
    <h3 class="text-gb-fg3 text-xs uppercase tracking-wider">Notepad</h3>
    <MarkdownEditor
      bind:value={$globalNote}
      placeholder="Training schedule, weekly goals, quotes…"
    />
  </div>
</div>

{#if selectedDate && selectedEntry && userId}
  <DayModal
    dateKey={selectedDate}
    entry={selectedEntry}
    activeTags={$activeTags}
    {userId}
    on:close={() => (selectedDate = null)}
  />
{/if}
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

Sign in and verify:
- Calendar shows current month with navigation arrows
- Clicking a day opens DayModal
- Saving a day updates the calendar (dot + label appear)
- Global notepad is editable and persists on blur

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: main calendar page with month nav, global notepad, and day modal"
```

---

### Task 13: Settings Page

**Files:**
- Create: `src/routes/settings/+page.svelte`

**Interfaces:**
- Consumes: `user`, `activeTags`, `addTag`, `deleteTag`, `updateTagColor`, `initTags`, `globalNote`, `initNote`, `saveNote`, `MarkdownEditor`, `GRUVBOX_COLORS`, `COLOR_ORDER`, `GruvboxColor`

- [ ] **Step 1: Implement Settings page**

Create `src/routes/settings/+page.svelte`:
```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { user } from '$lib/stores/auth';
  import { activeTags, addTag, deleteTag, updateTagColor, initTags } from '$lib/stores/tags';
  import { globalNote, initNote, saveNote } from '$lib/stores/note';
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
  import { GRUVBOX_COLORS, COLOR_ORDER } from '$lib/gruvbox';
  import type { GruvboxColor } from '$lib/types';

  $: userId = $user?.uid ?? '';

  let unsubTags: (() => void) | null = null;
  let unsubNote: (() => void) | null = null;

  $: if (userId) {
    unsubTags?.(); unsubTags = initTags(userId);
    unsubNote?.(); unsubNote = initNote(userId);
  }

  onDestroy(() => { unsubTags?.(); unsubNote?.(); });

  let newTagName = '';

  async function handleAdd() {
    if (!newTagName.trim()) return;
    await addTag(userId, newTagName.trim());
    newTagName = '';
  }

  function cycleColor(tagId: string, current: GruvboxColor) {
    const next = COLOR_ORDER[(COLOR_ORDER.indexOf(current) + 1) % COLOR_ORDER.length];
    updateTagColor(userId, tagId, next);
  }

  let noteSaveTimer: ReturnType<typeof setTimeout>;
  function scheduleNoteSave() {
    clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(() => { if (userId) saveNote(userId, $globalNote); }, 800);
  }
</script>

<div class="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-10">
  <h1 class="text-gb-yellow text-2xl font-bold">Settings</h1>

  <!-- Training types -->
  <section class="flex flex-col gap-4">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2">Training Types</h2>

    <ul class="flex flex-col gap-2">
      {#each $activeTags as tag (tag.id)}
        <li class="flex items-center gap-3 bg-gb-bg1 rounded-lg px-4 py-3">
          <button
            type="button"
            on:click={() => cycleColor(tag.id, tag.color)}
            style="background-color: {GRUVBOX_COLORS[tag.color]}"
            class="w-5 h-5 rounded-full shrink-0 border-2 border-gb-bg3 hover:scale-110 transition-transform"
            title="Click to change color"
          />
          <span class="flex-1 text-gb-fg text-sm">{tag.name}</span>
          <button
            type="button"
            on:click={() => deleteTag(userId, tag.id)}
            aria-label="Delete {tag.name}"
            class="text-gb-fg3 hover:text-gb-red transition-colors text-sm"
          >✕</button>
        </li>
      {/each}
    </ul>

    <div class="flex gap-2">
      <input
        type="text"
        bind:value={newTagName}
        placeholder="New training type"
        on:keydown={(e) => e.key === 'Enter' && handleAdd()}
        class="flex-1 bg-gb-bg1 text-gb-fg text-sm rounded-md px-3 py-2
               border border-gb-bg2 focus:outline-none focus:border-gb-blue"
      />
      <button
        type="button"
        on:click={handleAdd}
        class="bg-gb-blue text-gb-bg font-semibold px-4 py-2 rounded-md hover:opacity-90 transition text-sm"
      >Add</button>
    </div>
  </section>

  <!-- Global notepad -->
  <section class="flex flex-col gap-4">
    <h2 class="text-gb-fg font-semibold border-b border-gb-bg2 pb-2">Global Notepad</h2>
    <p class="text-gb-fg3 text-xs">Visible on the calendar page. Auto-saves on change.</p>
    <div on:focusout={scheduleNoteSave}>
      <MarkdownEditor
        bind:value={$globalNote}
        placeholder="Training schedule, weekly goals, quotes…"
      />
    </div>
  </section>
</div>
```

- [ ] **Step 2: Verify settings page in browser**

Navigate to `/settings` and verify:
- Active tags list with color swatches
- Clicking a swatch cycles through Gruvbox colors
- Adding a tag with Enter or Add button — appears in list and on calendar picker
- Deleting a tag removes from list (soft-delete — days still show color)
- Global notepad edits persist

- [ ] **Step 3: Commit**

```bash
git add src/routes/settings/+page.svelte
git commit -m "feat: settings page with tag management and global note editor"
```

---

### Task 14: Stats Placeholder + Final Build Check

**Files:**
- Create: `src/routes/stats/+page.svelte`

**Interfaces:**
- Produces: Stats page showing "Coming soon" within the app shell

- [ ] **Step 1: Create stats placeholder**

Create `src/routes/stats/+page.svelte`:
```svelte
<div class="p-4 md:p-8 max-w-2xl mx-auto">
  <h1 class="text-gb-yellow text-2xl font-bold mb-6">Stats</h1>
  <div class="bg-gb-bg1 rounded-xl p-10 text-center flex flex-col gap-2">
    <p class="text-gb-fg3 text-lg">Coming soon</p>
    <p class="text-gb-gray text-sm">Training analytics will appear here.</p>
  </div>
</div>
```

- [ ] **Step 2: Run all tests**

```bash
npm run test -- --run
```

Expected: All tests PASS with no failures.

- [ ] **Step 3: Type check**

```bash
npm run check
```

Expected: No TypeScript errors.

- [ ] **Step 4: Production build**

```bash
npm run build
```

Expected: Build succeeds. Output in `.svelte-kit/output/`.

- [ ] **Step 5: Preview build locally**

```bash
npm run preview
```

Verify the production build works: sign in, navigate all routes, create a day entry, check settings.

- [ ] **Step 6: Final commit**

```bash
git add src/routes/stats/+page.svelte
git commit -m "feat: stats placeholder and verify full build passes"
```

---

## Self-Review

**Spec coverage:**
- ✅ Calendar with colored dots per tag — Task 10
- ✅ Multiple colors per day — Task 10 (multiple dots)
- ✅ Global markdown notepad — Tasks 12 (main page), 13 (settings)
- ✅ Day view: tag selection — Task 11
- ✅ Day view: label field (separate from note) — Task 11
- ✅ Day view: markdown note — Task 11
- ✅ Note indicator on calendar cell — Task 10 (`data-has-note` dot)
- ✅ Left nav with Calendar / Stats / Settings — Task 9
- ✅ Mobile-friendly (bottom tab bar, modal as bottom drawer) — Tasks 9, 11
- ✅ Firebase Auth + Google Sign-In — Task 3
- ✅ Firestore per-user data — Tasks 4, 5, 6
- ✅ Auth guard — Task 3 (layout)
- ✅ Tag auto-color assignment — Tasks 2 (nextColor), 4 (addTag)
- ✅ Color cycling in Settings — Task 13 (cycleColor)
- ✅ Soft-delete (deleted tags still resolve on calendar) — Tasks 4, 10
- ✅ Gruvbox Dark palette — Task 1 (tailwind.config.js)
- ✅ Cloudflare Pages (adapter-static + fallback) — Task 1
- ✅ Firestore security rules — Task 1
- ✅ Stats placeholder — Task 14

**Type consistency:**
- `DayEntry { tags: string[], label: string, note: string }` — consistent Tasks 2, 5, 11, 12
- `TrainingTag { id, name, color, deleted }` — consistent Tasks 2, 4, 7, 10, 11
- `saveDay(userId, dateKey, DayEntry)` — Tasks 5 and 11 match
- `addTag(userId, name)` — Tasks 4 and 11 match
- `deleteTag(userId, tagId)` — Tasks 4 and 13 match
- `updateTagColor(userId, tagId, GruvboxColor)` — Tasks 4 and 13 match
- All `init*` functions return `() => void` and are used that way in Tasks 12 and 13
