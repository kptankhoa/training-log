import { writable, get } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { nextColor } from '$lib/gruvbox';
import type { PlanNote } from '$lib/types';

const _notes = writable<PlanNote[]>([]);
const _notesLoading = writable<boolean>(true);
export const notes = { subscribe: _notes.subscribe };
export const notesLoading = { subscribe: _notesLoading.subscribe };

export function initNotes(userId: string): () => void {
  _notesLoading.set(true);
  return onSnapshot(collection(db, 'users', userId, 'notes'), (snap) => {
    const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlanNote));
    loaded.sort((a, b) => a.sortOrder - b.sortOrder);
    _notes.set(loaded);
    _notesLoading.set(false);
  });
}

export async function addNote(userId: string): Promise<void> {
  const current = get(_notes);
  const maxOrder = current.length ? Math.max(...current.map((n) => n.sortOrder)) : 0;
  const color = nextColor(current.map((n) => n.color));
  await addDoc(collection(db, 'users', userId, 'notes'), {
    label: 'New note',
    sortOrder: maxOrder + 1,
    content: '',
    color,
  });
}

export async function saveNote(userId: string, noteId: string, data: Omit<PlanNote, 'id'>): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'notes', noteId), { ...data });
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'notes', noteId));
}
