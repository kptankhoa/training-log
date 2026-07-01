import type { DayEntry, ExerciseEntry, ExerciseSet } from '$lib/types';

/**
 * Most recent logged set for a given exercise, searching backward from the
 * most recent date (excluding the day currently being edited). Used to
 * pre-fill weight/reps so logging a repeat session needs minimal typing.
 */
export function getLastLoggedSet(
  allDays: Record<string, DayEntry>,
  exerciseId: string,
  excludeDateKey?: string
): ExerciseSet | null {
  const dateKeys = Object.keys(allDays)
    .filter((k) => k !== excludeDateKey)
    .sort()
    .reverse();

  for (const key of dateKeys) {
    const found = allDays[key].exercises?.find((e) => e.exerciseId === exerciseId);
    if (found && found.sets.length > 0) {
      return found.sets[found.sets.length - 1];
    }
  }
  return null;
}

/**
 * The most recent day's exercise list (excluding the day currently being
 * edited), for "copy last session" — seeds today's log with the same
 * exercises (no sets yet) so the user just logs sets rather than
 * re-adding exercises one by one.
 */
export function getLastSessionExercises(
  allDays: Record<string, DayEntry>,
  excludeDateKey?: string
): ExerciseEntry[] | null {
  const dateKeys = Object.keys(allDays)
    .filter((k) => k !== excludeDateKey)
    .sort()
    .reverse();

  for (const key of dateKeys) {
    const list = allDays[key].exercises;
    if (list && list.length > 0) return list;
  }
  return null;
}
