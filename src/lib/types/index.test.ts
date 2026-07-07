import { describe, it, expect } from 'vitest';
import { resolveSetType, formatSet, type ExerciseSet } from './index';

describe('resolveSetType', () => {
  it('returns the type field when present', () => {
    expect(resolveSetType({ type: 'bodyweight', reps: 12 })).toBe('bodyweight');
    expect(resolveSetType({ type: 'time', seconds: 45 })).toBe('time');
    expect(resolveSetType({ type: 'weight', weight: 60, reps: 8 })).toBe('weight');
  });

  it('falls back to "weight" for a legacy set with no type field', () => {
    // No cast needed — `type` is optional on the weight variant specifically,
    // so a bare { weight, reps } is already a valid ExerciseSet.
    const legacySet: ExerciseSet = { weight: 60, reps: 8 };
    expect(resolveSetType(legacySet)).toBe('weight');
  });
});

describe('formatSet', () => {
  it('formats a weight set as "weight×reps" with no unit', () => {
    expect(formatSet({ type: 'weight', weight: 60, reps: 8 })).toBe('60×8');
  });

  it('formats a weight set with equipment as "weight×reps EQUIP"', () => {
    expect(formatSet({ type: 'weight', weight: 60, reps: 8, equipment: 'barbell' })).toBe('60×8 BB');
    expect(formatSet({ type: 'weight', weight: 60, reps: 8, equipment: 'dumbbell' })).toBe('60×8 DB');
    expect(formatSet({ type: 'weight', weight: 60, reps: 8, equipment: 'cable' })).toBe('60×8 CB');
    expect(formatSet({ type: 'weight', weight: 60, reps: 8, equipment: 'machine' })).toBe('60×8 MC');
  });

  it('formats a legacy set with no type field the same as a weight set', () => {
    const legacySet: ExerciseSet = { weight: 60, reps: 8 };
    expect(formatSet(legacySet)).toBe('60×8');
  });

  it('formats a bodyweight set as "×reps"', () => {
    expect(formatSet({ type: 'bodyweight', reps: 12 })).toBe('×12');
  });

  it('formats a time set as "seconds followed by s"', () => {
    expect(formatSet({ type: 'time', seconds: 45 })).toBe('45s');
  });
});
