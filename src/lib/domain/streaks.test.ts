import { describe, it, expect } from 'vitest';
import { computeStreaks } from './streaks';
import type { DayEntry } from '$lib/types';

const trained = (): DayEntry => ({ tags: ['tag1'], label: '', note: '' });
const untrained = (): DayEntry => ({ tags: [], label: '', note: '' });

describe('computeStreaks', () => {
  it('returns zero for no data', () => {
    expect(computeStreaks({})).toEqual({ current: 0, longest: 0 });
  });

  it('ignores days with no tags logged', () => {
    const days = { '2026-06-10': untrained() };
    expect(computeStreaks(days, new Date('2026-06-10T12:00:00'))).toEqual({ current: 0, longest: 0 });
  });

  it('counts a single trained day ending today as a streak of 1', () => {
    const days = { '2026-06-10': trained() };
    const result = computeStreaks(days, new Date('2026-06-10T12:00:00'));
    expect(result).toEqual({ current: 1, longest: 1 });
  });

  it('counts consecutive trained days as one streak', () => {
    const days = {
      '2026-06-08': trained(),
      '2026-06-09': trained(),
      '2026-06-10': trained(),
    };
    const result = computeStreaks(days, new Date('2026-06-10T12:00:00'));
    expect(result).toEqual({ current: 3, longest: 3 });
  });

  it('breaks the current streak on a gap day', () => {
    const days = {
      '2026-06-05': trained(),
      '2026-06-08': trained(),
      '2026-06-09': trained(),
      '2026-06-10': trained(),
    };
    const result = computeStreaks(days, new Date('2026-06-10T12:00:00'));
    expect(result).toEqual({ current: 3, longest: 3 });
  });

  it('still counts a current streak if today has no entry yet, using yesterday', () => {
    const days = {
      '2026-06-08': trained(),
      '2026-06-09': trained(),
    };
    // "now" is June 10th, but June 10th has no entry yet
    const result = computeStreaks(days, new Date('2026-06-10T09:00:00'));
    expect(result.current).toBe(2);
  });

  it('resets current streak to 0 if there is a gap before today with no entry', () => {
    const days = {
      '2026-06-05': trained(),
      '2026-06-06': trained(),
    };
    // Today is June 10th (no entry) and yesterday June 9th also has no entry
    const result = computeStreaks(days, new Date('2026-06-10T09:00:00'));
    expect(result.current).toBe(0);
  });

  it('finds the longest streak even when it is not the current one', () => {
    const days = {
      '2026-06-01': trained(),
      '2026-06-02': trained(),
      '2026-06-03': trained(),
      '2026-06-04': trained(),
      '2026-06-05': trained(),
      // gap
      '2026-06-10': trained(),
    };
    const result = computeStreaks(days, new Date('2026-06-10T12:00:00'));
    expect(result).toEqual({ current: 1, longest: 5 });
  });

  it('treats a deleted tag reference the same as any other tag for streak purposes', () => {
    // computeStreaks only checks tags.length, it doesn't cross-reference the tags list
    const days = { '2026-06-10': { tags: ['now-deleted-tag'], label: '', note: '' } };
    const result = computeStreaks(days, new Date('2026-06-10T12:00:00'));
    expect(result.current).toBe(1);
  });
});
