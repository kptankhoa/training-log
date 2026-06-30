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
