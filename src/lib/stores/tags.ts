import { writable, derived, get } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { nextColor } from '$lib/gruvbox';
import type { TrainingTag, GruvboxColor } from '$lib/types';

const _tags = writable<TrainingTag[]>([]);

export const tags = { subscribe: _tags.subscribe };
export const activeTags = derived(_tags, ($t) => $t.filter((t) => !t.deleted));

export function initTags(userId: string): () => void {
  return onSnapshot(collection(db, 'users', userId, 'tags'), (snap) => {
    _tags.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TrainingTag, 'id'>) })));
  });
}

export async function addTag(userId: string, name: string): Promise<void> {
  const color = nextColor(get(activeTags).map((t) => t.color));
  await addDoc(collection(db, 'users', userId, 'tags'), { name, color, deleted: false });
}

export async function deleteTag(userId: string, tagId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'tags', tagId), { deleted: true });
}

export async function updateTagColor(userId: string, tagId: string, color: GruvboxColor): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'tags', tagId), { color });
}
