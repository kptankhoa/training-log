import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { BodyMeasurementEntry } from '$lib/types';

const _bodyMeasurements = writable<BodyMeasurementEntry[]>([]);
const _bodyMeasurementsLoading = writable<boolean>(true);
export const bodyMeasurements = { subscribe: _bodyMeasurements.subscribe };
export const bodyMeasurementsLoading = { subscribe: _bodyMeasurementsLoading.subscribe };

export function initBodyMeasurements(userId: string): () => void {
  _bodyMeasurementsLoading.set(true);
  return onSnapshot(collection(db, 'users', userId, 'measurements'), (snap) => {
    const loaded = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BodyMeasurementEntry, 'id'>) }));
    loaded.sort((a, b) => a.id.localeCompare(b.id));
    _bodyMeasurements.set(loaded);
    _bodyMeasurementsLoading.set(false);
  });
}

export async function saveBodyMeasurement(
  userId: string,
  dateKey: string,
  data: Partial<Omit<BodyMeasurementEntry, 'id'>>
): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'measurements', dateKey), data, { merge: true });
}

export async function deleteBodyMeasurement(userId: string, dateKey: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'measurements', dateKey));
}
