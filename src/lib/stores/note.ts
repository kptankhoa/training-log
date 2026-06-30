import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export const globalNote = writable<string>('');

export function initNote(userId: string): () => void {
  return onSnapshot(doc(db, 'users', userId, 'meta'), (snap) => {
    globalNote.set(snap.exists() ? (snap.data()?.globalNote ?? '') : '');
  });
}

export async function saveNote(userId: string, content: string): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'meta'), { globalNote: content }, { merge: true });
}
