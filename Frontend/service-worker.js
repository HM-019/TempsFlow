const CACHE_NAME = 'tempsflow-v1';
const ASSETS = [
  '/TempsFlow/Frontend/login/login.html',
  '/TempsFlow/Frontend/login/login.js',
  '/TempsFlow/Frontend/user/user.html',
  '/TempsFlow/Frontend/user/user.js',
  '/TempsFlow/Frontend/admin/admin.html',
  '/TempsFlow/Frontend/admin/admin.js',
  '/TempsFlow/Frontend/style.css'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});