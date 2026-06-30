import { writable } from 'svelte/store';
import { auth } from '$lib/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

export const user = writable<User | null>(null);
export const authReady = writable<boolean>(false);

onAuthStateChanged(auth, (u) => {
  user.set(u);
  authReady.set(true);
});

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}
