import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import {
  PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_AUTH_DOMAIN,
  PUBLIC_FIREBASE_PROJECT_ID,
  PUBLIC_FIREBASE_STORAGE_BUCKET,
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  PUBLIC_FIREBASE_APP_ID,
} from '$env/static/public';

// Exported so photos.ts can lazily construct a Storage instance without
// firebase/storage's SDK code being pulled into every route's bundle —
// Storage is only ever needed on the day-detail/photo-timeline screens.
export const app = initializeApp({
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
