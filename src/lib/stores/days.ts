import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { DayEntry } from '$lib/types';

const _allDays = writable<Record<string, DayEntry>>({});
const _daysLoading = writable<boolean>(true);

// Every day ever logged. Firestore has no way to query "this month" server-side
// against a YYYY-MM-DD doc id, so pages that only need one month filter this
// client-side with filterDaysByMonth() rather than opening a second listener.
export const allDays = { subscribe: _allDays.subscribe };
export const daysLoading = { subscribe: _daysLoading.subscribe };

export function initDays(userId: string): () => void {
  _daysLoading.set(true);
  return onSnapshot(
    collection(db, 'users', userId, 'days'),
    (snap) => {
      const all: Record<string, DayEntry> = {};
      snap.docs.forEach((d) => {
        all[d.id] = d.data() as DayEntry;
      });
      _allDays.set(all);
      _daysLoading.set(false);
    },
    (err) => {
      console.error('[initDays] error:', err);
      _daysLoading.set(false);
    }
  );
}

export function filterDaysByMonth(
  all: Record<string, DayEntry>,
  year: number,
  month: number
): Record<string, DayEntry> {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const entries: Record<string, DayEntry> = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(prefix)) entries[key] = value;
  }
  return entries;
}

export async function saveDay(userId: string, dateKey: string, entry: DayEntry): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'days', dateKey), entry, { merge: true });
}
