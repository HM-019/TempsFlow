const CACHE_NAME = 'tempsflow-v1';
const ASSETS = [
  '/login/login.html',
  '/login/login.js',
  '/user/user.html',
  '/user/user.js',
  '/admin/admin.html',
  '/admin/admin.js',
  '/style.css'
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