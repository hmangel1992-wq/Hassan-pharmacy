// AVARA service worker.
// Bump CACHE_VERSION whenever index.html or config.js changes, so returning
// visitors get the new file instead of a stale cached copy.
const CACHE_VERSION = 'avara-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/config.js',
  '/manifest.webmanifest',
  '/assets/logo.png',
  '/assets/logo-white.png',
  '/assets/hero-banner.jpg',
  '/assets/beauty-banner.jpg',
  '/assets/icon-192.png',
  '/assets/icon-384.png',
  '/assets/icon-512.png',
  '/assets/favicon-32.png',
  '/assets/apple-touch-icon.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function(cache){ return cache.addAll(PRECACHE); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys()
      .then(function(keys){
        return Promise.all(keys.filter(function(k){ return k !== CACHE_VERSION; }).map(function(k){ return caches.delete(k); }));
      })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET') return;

  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;           // let Supabase, fonts, CDN scripts pass through untouched
  if(url.pathname.indexOf('/api/') === 0) return;             // never cache the chat endpoint
  if(url.pathname.indexOf('/admin.html') === 0) return;       // admin dashboard stays out of the offline cache

  // HTML documents: try the network first, so people get new products,
  // prices and site changes as soon as they're online; fall back to the
  // last cached page when offline.
  if(req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1){
    event.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function(cache){ cache.put(req, copy); });
        return res;
      }).catch(function(){ return caches.match(req).then(function(r){ return r || caches.match('/index.html'); }); })
    );
    return;
  }

  // Everything else static (images, config.js, manifest): serve from cache
  // first for speed, refresh the cache in the background, fetch on a miss.
  event.respondWith(
    caches.match(req).then(function(cached){
      var fetchPromise = fetch(req).then(function(res){
        if(res && res.ok){
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function(cache){ cache.put(req, copy); });
        }
        return res;
      }).catch(function(){ return cached; });
      return cached || fetchPromise;
    })
  );
});
