// THE ASSASSIN SERVICE WORKER
// This script forces the browser to delete all cached versions of the app and unregister.

self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting zombie cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('Cache wiped. Unregistering Service Worker.');
      self.registration.unregister();
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Bypass all caching. Go straight to the network.
  event.respondWith(fetch(event.request));
});