/* Demo locale: serve l'app e inoltra login, database e funzioni agli emulatori Firebase,
 * tutto dallo stesso indirizzo (utile per l'anteprima). Avvio: bash demo/run.sh */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 8090;
const CONFIG = `self.EPICURO_CONFIG = { demo: true,
  firebase: { apiKey: "demo-key", authDomain: "demo-epicuro.firebaseapp.com", projectId: "demo-epicuro", storageBucket: "demo-epicuro.appspot.com", messagingSenderId: "1", appId: "1:1:web:1" },
  vapidKey: "demo", region: "europe-west1" };`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml' };

function proxy(req, res, port, target) {
  const up = http.request({ host: '127.0.0.1', port, path: target, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${port}` } }, (r) => {
    res.writeHead(r.statusCode, r.headers); r.pipe(res);
  });
  up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Emulatore non raggiungibile'); });
  req.pipe(up);
}

http.createServer((req, res) => {
  const u = req.url;
  if (/^\/(identitytoolkit|securetoken)\.googleapis\.com\//.test(u) || u.startsWith('/emulator/')) return proxy(req, res, 9099, u);
  if (u.startsWith('/google.firestore.v1.Firestore/') || u.startsWith('/v1/projects/')) return proxy(req, res, 8080, u);
  const fn = u.match(/^\/(createStaff|setStaffPassword|removeStaff)(\?.*)?$/);
  if (fn) return proxy(req, res, 5001, '/demo-epicuro/europe-west1/' + fn[1]);
  let f = decodeURIComponent(u.split('?')[0]);
  if (f === '/') f = '/index.html';
  if (f === '/config.js') { res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' }); return res.end(CONFIG); }
  if (f === '/firebase-messaging-sw.js') { res.writeHead(404); return res.end(); } // niente service worker in demo
  const fp = path.join(PUB, path.normalize(f));
  if (!fp.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); return res.end('Non trovato'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(d);
  });
}).listen(PORT, '0.0.0.0', () => console.log(`Demo Epicuro su http://127.0.0.1:${PORT}`));
