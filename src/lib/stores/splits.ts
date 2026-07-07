import { writable, get } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { nextColor } from '$lib/theme';
import type { Split } from '$lib/types';

// Splits started life as generic "plan notes", so they still live in the
// legacy 'notes' Firestore collection — migrating the collection to 'splits'
// is planned but deferred.
const COLLECTION = 'notes';

const _splits = writable<Split[]>([]);
const _splitsLoading = writable<boolean>(true);
export const splits = { subscribe: _splits.subscribe };
export const splitsLoading = { subscribe: _splitsLoading.subscribe };

export function initSplits(userId: string): () => void {
  _splitsLoading.set(true);
  return onSnapshot(collection(db, 'users', userId, COLLECTION), (snap) => {
    const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Split));
    loaded.sort((a, b) => a.sortOrder - b.sortOrder);
    _splits.set(loaded);
    _splitsLoading.set(false);
  });
}

export async function addSplit(userId: string): Promise<void> {
  const current = get(_splits);
  const maxOrder = current.length ? Math.max(...current.map((n) => n.sortOrder)) : 0;
  const color = nextColor(current.map((n) => n.color));
  await addDoc(collection(db, 'users', userId, COLLECTION), {
    label: 'New split',
    sortOrder: maxOrder + 1,
    content: '',
    color,
  });
}

export async function saveSplit(userId: string, splitId: string, data: Omit<Split, 'id'>): Promise<void> {
  await updateDoc(doc(db, 'users', userId, COLLECTION, splitId), { ...data });
}

export async function deleteSplit(userId: string, splitId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, COLLECTION, splitId));
}
