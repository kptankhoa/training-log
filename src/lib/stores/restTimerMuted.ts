import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

function initialMuted(): boolean {
  return localStorage.getItem('restTimerMuted') === 'true';
}

const _restTimerMuted = writable<boolean>(initialMuted());
export const restTimerMuted = { subscribe: _restTimerMuted.subscribe };

export function initRestTimerMuted(userId: string): () => void {
  return onSnapshot(doc(db, 'users', userId, 'meta', 'preferences'), (snap) => {
    _restTimerMuted.set(snap.data()?.restTimerMuted === true);
  });
}

export async function setRestTimerMuted(userId: string, value: boolean): Promise<void> {
  // Optimistic: a mute toggle needs to feel instant, unlike a settings-page
  // preference — don't wait on the Firestore round trip to reflect it. Skip
  // the write itself (rather than requiring every caller to guard) if there's
  // no signed-in user yet — the toggle should still work locally in that case.
  _restTimerMuted.set(value);
  if (!userId) return;
  await setDoc(doc(db, 'users', userId, 'meta', 'preferences'), { restTimerMuted: value }, { merge: true });
}
