const CACHE_NAME = 'earntrack-v4';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js'
];

// Install - pre-cache app shell only (NOT data.json)
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - clear old caches immediately
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch strategy:
// - GitHub API calls: always network only (never cache, never intercept)
// - data.json: always network only (data must be fresh)
// - App shell assets: cache first, fallback to network
self.addEventListener('fetch', e => {
    const url = e.request.url;

    // Never intercept GitHub API calls — let them pass through untouched
    if (url.includes('api.github.com')) {
        return;
    }

    // Never cache data.json — always fetch fresh
    if (url.includes('data.json')) {
        e.respondWith(fetch(e.request));
        return;
    }

    // App shell: cache-first with network fallback
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(resp => {
                // Only cache successful same-origin or CDN responses
                if (resp && resp.status === 200) {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return resp;
            });
        }).catch(() => {
            // Offline fallback: return index.html for navigation requests
            if (e.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});
