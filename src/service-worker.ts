/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// SvelteKit generates `build`/`files`/`version` for us from the actual
// build output — this file has no hardcoded asset list to keep in sync.
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `cache-${version}`;
const ASSETS = new Set([...build, ...files]);

// Every route serves the same shell (this is a pure client-side SPA —
// ssr=false, prerender=false — so there's no per-route HTML to precache).
// A service worker never controls the page that first registered it, so
// without this, a single first-ever visit wouldn't be enough for offline
// to work: the shell only gets cached opportunistically once the worker
// starts controlling later navigations. Precaching it directly here means
// even a brand-new install can serve *something* offline immediately.
const APP_SHELL = '/';

sw.addEventListener('install', (event) => {
  async function addFilesToCache() {
    const cache = await caches.open(CACHE);
    await cache.addAll([...ASSETS, APP_SHELL]);
  }
  event.waitUntil(addFilesToCache());
});

sw.addEventListener('activate', (event) => {
  async function deleteOldCaches() {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
  }
  event.waitUntil(deleteOldCaches());
});

sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only handle same-origin requests — Firestore/Firebase Auth's
  // long-lived streaming requests to googleapis.com must never be
  // intercepted here, or their offline queueing/retry logic breaks.
  if (url.origin !== sw.location.origin) return;

  async function respond(): Promise<Response> {
    const cache = await caches.open(CACHE);

    // Built assets are content-hashed and immutable — serve straight from
    // cache with no network round trip at all.
    if (ASSETS.has(url.pathname)) {
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
    }

    // Everything else (the page shell, static/ files): try the network
    // first so a signal means fresh content, falling back to whatever's
    // cached when offline — this is what lets the app open at all with no
    // signal in the gym.
    try {
      const response = await fetch(event.request);
      if (response.status === 200) {
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (err) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      // Never-before-visited route while offline — fall back to the app
      // shell so the SPA still boots and can render whatever Firestore
      // already has cached locally, instead of a browser network-error page.
      if (event.request.mode === 'navigate') {
        const shell = await cache.match(APP_SHELL);
        if (shell) return shell;
      }
      throw err;
    }
  }

  event.respondWith(respond());
});
