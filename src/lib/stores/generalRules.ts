import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const _generalRules = writable<string>('');
const _generalRulesLoading = writable<boolean>(true);

export const generalRules = { subscribe: _generalRules.subscribe };
export const generalRulesLoading = { subscribe: _generalRulesLoading.subscribe };

export function initGeneralRules(userId: string): () => void {
  _generalRulesLoading.set(true);
  return onSnapshot(doc(db, 'users', userId, 'meta', 'generalRules'), (snap) => {
    _generalRules.set(snap.exists() ? (snap.data()?.content ?? '') : '');
    _generalRulesLoading.set(false);
  });
}

export async function saveGeneralRules(userId: string, content: string): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'meta', 'generalRules'), { content }, { merge: true });
}
