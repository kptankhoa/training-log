import { writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export type RestTimerSound = 'ding' | 'ding2' | 'ding3';

const SOUNDS: RestTimerSound[] = ['ding', 'ding2', 'ding3'];

export const SOUND_OPTIONS: { value: RestTimerSound; label: string }[] = [
  { value: 'ding', label: '1' },
  { value: 'ding2', label: '2' },
  { value: 'ding3', label: '3' },
];

const SOUND_PATHS: Record<RestTimerSound, string> = {
  ding: '/sounds/ding.mp3',
  ding2: '/sounds/ding2.mp3',
  ding3: '/sounds/ding3.mp3',
};

// Best-effort: browsers may reject playback if no user gesture has unlocked
// audio yet, but both call sites (picking a sound in Settings, the rest
// timer finishing after a Start tap) happen within a gesture-primed page.
export function playRestTimerSound(sound: RestTimerSound): void {
  new Audio(SOUND_PATHS[sound]).play()?.catch(() => {});
}

function isRestTimerSound(value: unknown): value is RestTimerSound {
  return SOUNDS.includes(value as RestTimerSound);
}

function initialSound(): RestTimerSound {
  const cached = localStorage.getItem('restTimerSound');
  return isRestTimerSound(cached) ? cached : 'ding';
}

const _restTimerSound = writable<RestTimerSound>(initialSound());
export const restTimerSound = { subscribe: _restTimerSound.subscribe };

export function initRestTimerSound(userId: string): () => void {
  return onSnapshot(doc(db, 'users', userId, 'meta', 'preferences'), (snap) => {
    const value = snap.data()?.restTimerSound;
    _restTimerSound.set(isRestTimerSound(value) ? value : 'ding');
  });
}

export async function setRestTimerSound(userId: string, value: RestTimerSound): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'meta', 'preferences'), { restTimerSound: value }, { merge: true });
}
