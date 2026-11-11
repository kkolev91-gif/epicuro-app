/* Epicuro Staff — service worker: notifiche in arrivo a app chiusa e copia locale dell'app. */
importScripts('/config.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const CFG = self.EPICURO_CONFIG || {};
const CONFIGURED = CFG.firebase && !String(CFG.firebase.apiKey).startsWith('INSERISCI');
if (CONFIGURED) {
  firebase.initializeApp(CFG.firebase);
  // Le notifiche con titolo e testo vengono mostrate in automatico dall'SDK quando l'app è chiusa.
  firebase.messaging();
}

const CACHE = 'epicuro-v5';
const SHELL = ['/', '/index.html', '/app.js', '/config.js', '/manifest.webmanifest', '/icons/icon-192.png', '/vendor/qrcode.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Prima la rete (dati sempre aggiornati), la copia locale solo se si è senza connessione.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
  );
});
