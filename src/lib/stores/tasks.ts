import { writable, derived } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import type { DailyTask } from '$lib/types';

const _tasks = writable<DailyTask[]>([]);
const _tasksLoading = writable<boolean>(true);

export const tasks = { subscribe: _tasks.subscribe };
export const tasksLoading = { subscribe: _tasksLoading.subscribe };
export const activeTasks = derived(_tasks, ($t) => $t.filter((t) => !t.deleted));

export function initTasks(userId: string): () => void {
  _tasksLoading.set(true);
  return onSnapshot(collection(db, 'users', userId, 'tasks'), (snap) => {
    _tasks.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DailyTask, 'id'>) })));
    _tasksLoading.set(false);
  });
}

export async function addTask(userId: string, name: string): Promise<void> {
  await addDoc(collection(db, 'users', userId, 'tasks'), { name, deleted: false });
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'tasks', taskId), { deleted: true });
}
