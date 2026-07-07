import type { DayEntry } from '$lib/types';

export interface Streaks {
  current: number;
  longest: number;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * A day counts toward a streak if it has at least one training tag logged.
 * `now` is injectable so "current streak" is testable against a fixed date.
 */
export function computeStreaks(days: Record<string, DayEntry>, now: Date = new Date()): Streaks {
  const trainedKeys = Object.entries(days)
    .filter(([, entry]) => entry.tags.length > 0)
    .map(([key]) => key)
    .sort();

  if (trainedKeys.length === 0) return { current: 0, longest: 0 };

  const trainedSet = new Set(trainedKeys);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < trainedKeys.length; i++) {
    const prev = new Date(`${trainedKeys[i - 1]}T00:00:00`);
    const curr = new Date(`${trainedKeys[i]}T00:00:00`);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    run = diffDays === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!trainedSet.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1); // today not logged yet — check if yesterday keeps a streak alive
  }

  let current = 0;
  while (trainedSet.has(toDateKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, longest };
}
