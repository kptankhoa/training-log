import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { BodyMeasurement } from '$lib/types';

const _measurements = writable<BodyMeasurement[]>([]);
export const measurements = { subscribe: _measurements.subscribe };

export function initMeasurements(userId: string): () => void {
  return onSnapshot(collection(db, 'users', userId, 'measurements'), (snap) => {
    const loaded = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BodyMeasurement, 'id'>) }));
    loaded.sort((a, b) => a.id.localeCompare(b.id));
    _measurements.set(loaded);
  });
}

export async function saveMeasurement(userId: string, dateKey: string, data: Omit<BodyMeasurement, 'id'>): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'measurements', dateKey), data, { merge: true });
}

export async function deleteMeasurement(userId: string, dateKey: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'measurements', dateKey));
}
