const CACHE_NAME = 'toko-kita-pos-v2';
const urlsToCache = [
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
