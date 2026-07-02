import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import {
  PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_AUTH_DOMAIN,
  PUBLIC_FIREBASE_PROJECT_ID,
  PUBLIC_FIREBASE_STORAGE_BUCKET,
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  PUBLIC_FIREBASE_APP_ID,
} from '$env/static/public';

const app = initializeApp({
  apiKey:            PUBLIC_FIREBASE_API_KEY,
  authDomain:        PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             PUBLIC_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
// Offline-first: reads serve from IndexedDB instantly and writes queue while
// offline, surviving app restarts until they sync. Multi-tab manager keeps the
// cache usable when the app is open in more than one tab.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = getStorage(app);
