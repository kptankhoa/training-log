import { describe, it, expect, vi, beforeEach } from 'vitest';

const format = vi.fn();

vi.mock('prettier/standalone', () => ({ format }));
vi.mock('prettier/plugins/markdown', () => ({ default: 'markdown-plugin-stub' }));

import { formatMarkdown, preloadMarkdownFormatter } from './formatMarkdown';

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

  it('exports a preload function that can be called without throwing', () => {
    expect(() => preloadMarkdownFormatter()).not.toThrow();
  });
});
