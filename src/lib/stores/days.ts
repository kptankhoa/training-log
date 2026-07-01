import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { DayEntry } from '$lib/types';

const _days = writable<Record<string, DayEntry>>({});
const _allDays = writable<Record<string, DayEntry>>({});
const _daysLoading = writable<boolean>(true);

export const days = { subscribe: _days.subscribe };
// Unfiltered across all months — the onSnapshot listener already receives the
// whole collection (Firestore has no way to query "this month" server-side
// against a YYYY-MM-DD doc id), so this is free to populate alongside `days`.
export const allDays = { subscribe: _allDays.subscribe };
export const daysLoading = { subscribe: _daysLoading.subscribe };

export function initDays(userId: string, year: number, month: number): () => void {
  _daysLoading.set(true);
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return onSnapshot(
    collection(db, 'users', userId, 'days'),
    (snap) => {
      const entries: Record<string, DayEntry> = {};
      const all: Record<string, DayEntry> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as DayEntry;
        all[d.id] = data;
        if (d.id.startsWith(prefix)) entries[d.id] = data;
      });
      _days.set(entries);
      _allDays.set(all);
      _daysLoading.set(false);
    },
    (err) => {
      console.error('[initDays] error:', err);
      _daysLoading.set(false);
    }
  );
}

export async function saveDay(userId: string, dateKey: string, entry: DayEntry): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'days', dateKey), entry, { merge: true });
}
