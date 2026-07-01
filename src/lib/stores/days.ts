import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { DayEntry } from '$lib/types';

const _days = writable<Record<string, DayEntry>>({});
const _daysLoading = writable<boolean>(true);

export const days = { subscribe: _days.subscribe };
export const daysLoading = { subscribe: _daysLoading.subscribe };

export function initDays(userId: string, year: number, month: number): () => void {
  _daysLoading.set(true);
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return onSnapshot(
    collection(db, 'users', userId, 'days'),
    (snap) => {
      const entries: Record<string, DayEntry> = {};
      snap.docs.forEach((d) => {
        if (d.id.startsWith(prefix)) entries[d.id] = d.data() as DayEntry;
      });
      _days.set(entries);
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
