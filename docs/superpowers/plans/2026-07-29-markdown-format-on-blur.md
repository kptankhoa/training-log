# Markdown Auto-Format on Blur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically tidy up markdown (table alignment, heading/list/blank-line normalization) in `MarkdownEditor.svelte` whenever its textarea loses focus.

**Architecture:** A new pure async helper `formatMarkdown()` in `src/lib/domain/` wraps Prettier's markdown formatter, dynamically importing `prettier/standalone` + `prettier/plugins/markdown` so Prettier never lands in the main bundle. `MarkdownEditor.svelte` calls it from an `on:blur` handler and reassigns the two-way-bound `value` prop, so every existing call site (day notes, splits, general rules) gets the behavior for free.

**Tech Stack:** SvelteKit 2 / Svelte 5 (legacy syntax), TypeScript, Vitest + @testing-library/svelte, Prettier v3 (`prettier/standalone`, `prettier/plugins/markdown`).

## Global Constraints

- `npm run check` must be 0 errors before committing (per project convention).
- `prettier` goes in `package.json` `dependencies`, not `devDependencies` — it's invoked at runtime via dynamic import, not just at dev/build time.
- `proseWrap` must be `'preserve'` — paragraphs/prose must never be rewrapped, only markdown syntax (tables, headings, lists, spacing) normalized.
- Any formatting failure (import failure or parser throw) must fall back to the original, unmodified string — no data loss, no unhandled rejection, no toast.
- New helper goes in `src/lib/domain/` (pure, no UI/Firestore dependency) and is exported from `src/lib/domain/index.ts`, per the existing barrel pattern.
- `MarkdownEditor.svelte` must import from the `$lib/domain` barrel, not reach into `$lib/domain/formatMarkdown` directly (matches existing call sites like `ExerciseEditor.svelte`, `Calendar.svelte`).

---

### Task 1: `formatMarkdown()` domain helper

**Files:**
- Create: `src/lib/domain/formatMarkdown.ts`
- Create: `src/lib/domain/formatMarkdown.test.ts`
- Modify: `src/lib/domain/index.ts`
- Modify: `package.json` (add `prettier` dependency)

**Interfaces:**
- Produces: `export async function formatMarkdown(value: string): Promise<string>` — later tasks (`MarkdownEditor.svelte`) import this by name from `$lib/domain`.

- [ ] **Step 1: Install Prettier**

Run: `npm install prettier@^3`

This adds `prettier` to `dependencies` in `package.json` (npm puts it there by default since there's no `--save-dev`flag). Confirm afterward that `package.json`'s `dependencies` block (not `devDependencies`) contains `"prettier": "^3.x.x"`.

- [ ] **Step 2: Write the failing test**

Create `src/lib/domain/formatMarkdown.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const format = vi.fn();

vi.mock('prettier/standalone', () => ({ format }));
vi.mock('prettier/plugins/markdown', () => ({ default: 'markdown-plugin-stub' }));

import { formatMarkdown } from './formatMarkdown';

describe('formatMarkdown', () => {
  beforeEach(() => {
    format.mockReset();
  });

  it('formats with the markdown parser, the markdown plugin, and preserved prose wrap', async () => {
    format.mockResolvedValue('| a   | bb  |\n| --- | --- |\n| 1   | 2   |\n');

    const result = await formatMarkdown('| a | bb |\n|---|---|\n| 1 | 2 |');

    expect(format).toHaveBeenCalledWith('| a | bb |\n|---|---|\n| 1 | 2 |', {
      parser: 'markdown',
      plugins: ['markdown-plugin-stub'],
      proseWrap: 'preserve'
    });
    expect(result).toBe('| a   | bb  |\n| --- | --- |\n| 1   | 2   |');
  });

  it('trims trailing whitespace Prettier adds', async () => {
    format.mockResolvedValue('# hello\n\n\n');

    const result = await formatMarkdown('# hello');

    expect(result).toBe('# hello');
  });

  it('falls back to the original string when formatting throws', async () => {
    format.mockRejectedValue(new Error('parse error'));
    const input = 'some markdown that fails to format';

    const result = await formatMarkdown(input);

    expect(result).toBe(input);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/domain/formatMarkdown.test.ts`
Expected: FAIL — `Failed to resolve import "./formatMarkdown"` (file doesn't exist yet).

- [ ] **Step 4: Write the implementation**

Create `src/lib/domain/formatMarkdown.ts`:

```ts
export async function formatMarkdown(value: string): Promise<string> {
  try {
    const [{ format }, { default: markdownPlugin }] = await Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/markdown')
    ]);
    const formatted = await format(value, {
      parser: 'markdown',
      plugins: [markdownPlugin],
      proseWrap: 'preserve'
    });
    return formatted.trimEnd();
  } catch {
    return value;
  }
}
```

- [ ] **Step 5: Add the barrel export**

Modify `src/lib/domain/index.ts` to add the new export (keep alphabetical-ish grouping consistent with the existing three lines):

```ts
export * from './streaks';
export * from './exerciseHistory';
export * from './subscriptions';
export * from './formatMarkdown';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/domain/formatMarkdown.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/domain/formatMarkdown.ts src/lib/domain/formatMarkdown.test.ts src/lib/domain/index.ts
git commit -m "feat: add formatMarkdown domain helper backed by Prettier"
```

---

### Task 2: Wire `formatMarkdown` into `MarkdownEditor.svelte` on blur

**Files:**
- Modify: `src/lib/components/shared/MarkdownEditor.svelte`
- Create: `src/lib/components/shared/MarkdownEditorTest.svelte`
- Modify: `src/lib/components/shared/MarkdownEditor.test.ts`

**Interfaces:**
- Consumes: `formatMarkdown(value: string): Promise<string>` from `$lib/domain` (Task 1).

- [ ] **Step 1: Write the failing test wrapper**

Create `src/lib/components/shared/MarkdownEditorTest.svelte` (two-way `bind:value` needs a wrapper to observe from a test, per the existing `DayModalTest.svelte` pattern):

```svelte
<script lang="ts">
  import MarkdownEditor from './MarkdownEditor.svelte';

  export let value: string = '';
</script>

<MarkdownEditor bind:value placeholder="" />

<div data-testid="value">{value}</div>
```

- [ ] **Step 2: Write the failing test**

Add to `src/lib/components/shared/MarkdownEditor.test.ts`, alongside the existing top-of-file mock:

```ts
vi.mock('$lib/domain', () => ({
  formatMarkdown: vi.fn(async (value: string) =>
    value.replace('| a | bb |', '| a  | bb |')
  )
}));
```

And add this test at the end of the `describe` block:

```ts
  it('formats the value on blur', async () => {
    const { getByRole, getByTestId } = render(MarkdownEditorTest, {
      props: { value: '' }
    });
    const textarea = getByRole('textbox');
    await fireEvent.input(textarea, { target: { value: '| a | bb |' } });
    await fireEvent.blur(textarea);
    expect(getByTestId('value')).toHaveTextContent('| a  | bb |');
  });
```

Add the import at the top of the test file:

```ts
import MarkdownEditorTest from './MarkdownEditorTest.svelte';
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/components/shared/MarkdownEditor.test.ts`
Expected: FAIL — the new test's assertion fails (blur doesn't call `formatMarkdown` yet), since `MarkdownEditor.svelte` has no blur handler.

- [ ] **Step 4: Implement the blur handler**

Modify `src/lib/components/shared/MarkdownEditor.svelte`. Add the import and handler in the `<script>` block:

```ts
import { formatMarkdown } from '$lib/domain';
```

```ts
async function handleBlur() {
  value = await formatMarkdown(value);
}
```

Add `on:blur={handleBlur}` to the textarea, next to the existing `on:focus`:

```svelte
    <textarea
      bind:value
      {placeholder}
      {rows}
      on:focus={(e) => scrollIntoViewOnFocus(e.currentTarget)}
      on:blur={handleBlur}
      class="w-full bg-gb-light-bg2 dark:bg-gb-bg2 text-gb-light-fg dark:text-gb-fg font-mono text-sm rounded-md p-3 resize-y
             border border-gb-light-bg3 dark:border-gb-bg3 focus:outline-none focus:border-gb-light-blue dark:focus:border-gb-blue [caret-shape:block]"
    ></textarea>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/components/shared/MarkdownEditor.test.ts`
Expected: PASS (all tests, including the new one).

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions in `DayDetailEditForm`/`splits` tests that render `MarkdownEditor`.

- [ ] **Step 7: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/shared/MarkdownEditor.svelte src/lib/components/shared/MarkdownEditorTest.svelte src/lib/components/shared/MarkdownEditor.test.ts
git commit -m "feat: auto-format markdown on textarea blur"
```

---

## Manual Verification (after both tasks)

- [ ] Run `npm run dev`, open a day with a note, type a misaligned pipe table (e.g. `| a | bb |` / `|---|---|` / `| 1 | 2 |` each on its own line), click elsewhere to blur the textarea, and confirm the table re-renders with aligned columns directly in the textarea.
- [ ] Repeat on the Splits page (split content) and General Rules editor to confirm all three call sites pick up the behavior with no per-page changes.
- [ ] Type a paragraph with a manual line break in the middle of a sentence, blur, and confirm the line break is preserved (not rewrapped into one line) — validates `proseWrap: 'preserve'`.
