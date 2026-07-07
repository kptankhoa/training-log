import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { nextColor } from './gruvbox';
import type { GruvboxColor } from '../types';

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

const mocks = vi.hoisted(() => ({ theme: 'dark' as 'dark' | 'light' }));
vi.mock('../stores/theme', () => ({
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
