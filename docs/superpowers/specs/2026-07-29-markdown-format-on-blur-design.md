# Markdown Auto-Format on Blur

## Problem

`MarkdownEditor.svelte` is a plain textarea + `marked` preview toggle, used for day notes, splits, and general training rules. Markdown typed by hand — especially tables — tends to drift out of alignment (`| a | bb |` next to `| ccc | d |`), and there's no formatting help today. Editing should tidy up the markdown (table column alignment, heading/list/blank-line normalization) automatically, without the user having to think about it or press a separate "format" button.

## Approach

Use Prettier's markdown formatter (`prettier/standalone` + `prettier/plugins/markdown`), run on textarea blur, with `proseWrap: 'preserve'` so free-form prose (quotes, PR notes) never gets rewrapped — only markdown syntax (tables, headings, lists, spacing) is normalized. Both packages are dynamically `import()`-ed on first use so Prettier's parser never lands in the app's main bundle; it's fetched lazily and cached by the module loader after the first blur anywhere in the app.

## `src/lib/domain/formatMarkdown.ts` (new)

```ts
export async function formatMarkdown(value: string): Promise<string> {
  try {
    const [{ format }, markdownPlugin] = await Promise.all([
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

- Exported from the `domain/` barrel (`src/lib/domain/index.ts`) alongside `streaks`/`exerciseHistory`.
- Pure, no UI or Firestore dependency, consistent with the rest of `domain/`.
- The whole body (including the dynamic imports, not just the format call) is wrapped in one try/catch: a failed import (e.g. first-ever blur while fully offline) and a formatting error (malformed input, parser edge case) both fall back to the original string rather than risking mangled/lost text or an unhandled rejection. No toast — nothing is being persisted or lost, just left unformatted for this pass.

## `src/lib/components/shared/MarkdownEditor.svelte`

- Add an `on:blur` handler on the textarea, alongside the existing `on:focus={scrollIntoViewOnFocus}`:

```ts
async function handleBlur() {
  value = await formatMarkdown(value);
}
```

- Blur is a safe point to rewrite `value` — focus is already leaving the field, so there's no cursor-jump concern.
- `value` is a two-way bound prop, so the formatted result flows straight back out to all three existing call sites (`DayDetailEditForm.svelte`, `splits/+page.svelte` for both split content and general rules) with no changes needed at those call sites.

## Dependency

- Add `prettier` (v3) to `package.json` `dependencies` (not `devDependencies` — it's used at runtime via dynamic import, not just for tooling).

## Testing

- `src/lib/domain/formatMarkdown.test.ts` (new): mock `prettier/standalone` / `prettier/plugins/markdown`; assert a misaligned table gets column-aligned; assert a formatting throw falls back to the original input unchanged.
- `MarkdownEditor.test.ts`: mock `prettier/standalone` / `prettier/plugins/markdown` at the top of the file, same pattern as the existing `marked` mock. Since asserting the blur-triggered update requires observing the two-way `bind:value`, add a thin `MarkdownEditorTest.svelte` wrapper (matching the existing `DayModalTest.svelte` pattern) and add a test: type unaligned table text into the textarea, fire `blur`, assert the bound value comes back formatted.

## Out of Scope

- No manual "Format" button — formatting only happens on blur.
- No configurability of Prettier options (proseWrap is fixed to `'preserve'`; no per-user settings).
- No formatting on the read-only preview pane (it already renders whatever `value` currently is via `marked`).
