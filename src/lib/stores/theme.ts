import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export type Theme = 'dark' | 'light';

function initialTheme(): Theme {
  return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
}

const _theme = writable<Theme>(initialTheme());
export const theme = { subscribe: _theme.subscribe };

export function initTheme(userId: string): () => void {
  return onSnapshot(doc(db, 'users', userId, 'meta', 'preferences'), (snap) => {
    const value = snap.data()?.theme;
    _theme.set(value === 'light' ? 'light' : 'dark');
  });
}

export async function setTheme(userId: string, value: Theme): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'meta', 'preferences'), { theme: value }, { merge: true });
}
