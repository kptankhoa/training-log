import { describe, it, expect } from 'vitest';
import { getLastLoggedSet, getLastSessionExercises } from './exerciseHistory';
import type { DayEntry } from '$lib/types';

describe('getLastLoggedSet', () => {
  it('returns null when the exercise was never logged', () => {
    const days: Record<string, DayEntry> = {
      '2026-06-10': { tags: [], label: '', note: '', exercises: [] },
    };
    expect(getLastLoggedSet(days, 'bench')).toBeNull();
  });

  it('returns the last set from the most recent day it was logged', () => {
    const days: Record<string, DayEntry> = {
      '2026-06-08': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [{ weight: 70, reps: 10 }] }] },
      '2026-06-10': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 6 }] }] },
    };
    expect(getLastLoggedSet(days, 'bench')).toEqual({ weight: 80, reps: 6 });
  });

  it('excludes the given date key (the day currently being edited)', () => {
    const days: Record<string, DayEntry> = {
      '2026-06-08': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [{ weight: 70, reps: 10 }] }] },
      '2026-06-10': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [{ weight: 80, reps: 8 }] }] },
    };
    expect(getLastLoggedSet(days, 'bench', '2026-06-10')).toEqual({ weight: 70, reps: 10 });
  });

  it('skips days where the exercise has no sets logged yet', () => {
    const days: Record<string, DayEntry> = {
      '2026-06-08': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [{ weight: 70, reps: 10 }] }] },
      '2026-06-10': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [] }] },
    };
    expect(getLastLoggedSet(days, 'bench')).toEqual({ weight: 70, reps: 10 });
  });
});

describe('getLastSessionExercises', () => {
  it('returns null when no day has any exercises logged', () => {
    const days: Record<string, DayEntry> = {
      '2026-06-10': { tags: [], label: '', note: '' },
    };
    expect(getLastSessionExercises(days)).toBeNull();
  });

  it('returns the exercise list from the most recent day with exercises', () => {
    const days: Record<string, DayEntry> = {
      '2026-06-08': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'squat', sets: [] }] },
      '2026-06-10': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [] }, { exerciseId: 'ohp', sets: [] }] },
    };
    expect(getLastSessionExercises(days)).toEqual([{ exerciseId: 'bench', sets: [] }, { exerciseId: 'ohp', sets: [] }]);
  });

  it('excludes the given date key', () => {
    const days: Record<string, DayEntry> = {
      '2026-06-08': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'squat', sets: [] }] },
      '2026-06-10': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'bench', sets: [] }] },
    };
    expect(getLastSessionExercises(days, '2026-06-10')).toEqual([{ exerciseId: 'squat', sets: [] }]);
  });

  it('skips days with an empty exercises array', () => {
    const days: Record<string, DayEntry> = {
      '2026-06-08': { tags: [], label: '', note: '', exercises: [{ exerciseId: 'squat', sets: [] }] },
      '2026-06-10': { tags: [], label: '', note: '', exercises: [] },
    };
    expect(getLastSessionExercises(days)).toEqual([{ exerciseId: 'squat', sets: [] }]);
  });
});
