import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, doc, onSnapshot, setDoc, query, where, documentId } from 'firebase/firestore';
import type { DayEntry } from '$lib/types';

const _days = writable<Record<string, DayEntry>>({});

export const days = { subscribe: _days.subscribe };

export function initDays(userId: string, year: number, month: number): () => void {
  const m = String(month).padStart(2, '0');
  const q = query(
    collection(db, 'users', userId, 'days'),
    where(documentId(), '>=', `${year}-${m}-01`),
    where(documentId(), '<=', `${year}-${m}-31`)
  );
  return onSnapshot(q, (snap) => {
    const entries: Record<string, DayEntry> = {};
    snap.docs.forEach((d) => { entries[d.id] = d.data() as DayEntry; });
    _days.set(entries);
  });
}

export async function saveDay(userId: string, dateKey: string, entry: DayEntry): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'days', dateKey), entry, { merge: true });
}
