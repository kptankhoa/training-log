import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { BodyMeasurement } from '$lib/types';

const _measurements = writable<BodyMeasurement[]>([]);
const _measurementsLoading = writable<boolean>(true);
export const measurements = { subscribe: _measurements.subscribe };
export const measurementsLoading = { subscribe: _measurementsLoading.subscribe };

export function initMeasurements(userId: string): () => void {
  _measurementsLoading.set(true);
  return onSnapshot(collection(db, 'users', userId, 'metrics'), (snap) => {
    const loaded = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BodyMeasurement, 'id'>) }));
    loaded.sort((a, b) => a.id.localeCompare(b.id));
    _measurements.set(loaded);
    _measurementsLoading.set(false);
  });
}

export async function saveMeasurement(userId: string, dateKey: string, data: Omit<BodyMeasurement, 'id'>): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'metrics', dateKey), data, { merge: true });
}

export async function deleteMeasurement(userId: string, dateKey: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'metrics', dateKey));
}
