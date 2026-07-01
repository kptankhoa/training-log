import { writable, derived } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import type { Exercise } from '$lib/types';

const _exercises = writable<Exercise[]>([]);
const _exercisesLoading = writable<boolean>(true);

export const exercises = { subscribe: _exercises.subscribe };
export const exercisesLoading = { subscribe: _exercisesLoading.subscribe };
export const activeExercises = derived(_exercises, ($e) => $e.filter((e) => !e.deleted));

export function initExercises(userId: string): () => void {
  _exercisesLoading.set(true);
  return onSnapshot(collection(db, 'users', userId, 'exercises'), (snap) => {
    _exercises.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exercise, 'id'>) })));
    _exercisesLoading.set(false);
  });
}

export async function addExercise(userId: string, name: string): Promise<string> {
  const ref = await addDoc(collection(db, 'users', userId, 'exercises'), { name, deleted: false });
  return ref.id;
}

export async function deleteExercise(userId: string, exerciseId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'exercises', exerciseId), { deleted: true });
}

export async function updateExerciseSplits(userId: string, exerciseId: string, splitIds: string[]): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'exercises', exerciseId), { splitIds });
}
