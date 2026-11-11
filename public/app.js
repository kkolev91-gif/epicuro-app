/* Epicuro Staff — app per lo staff: turni, cantina, utenti e notifiche. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, query, where, onSnapshot, orderBy, getDoc, setDoc, updateDoc, deleteDoc, writeBatch,
  serverTimestamp, increment, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { getMessaging, getToken, onMessage, isSupported as messagingSupported } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';

/* ---------- configurazione ---------- */
const CFG = self.EPICURO_CONFIG || {};
const CONFIGURED = !!(CFG.firebase && !String(CFG.firebase.apiKey).startsWith('INSERISCI'));
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const EMAIL_DOMAIN = 'staff.epicuro.app';
const emailOf = (u) => `${String(u).trim().toLowerCase()}@${EMAIL_DOMAIN}`;

/* ---------- costanti ---------- */
const TYPES = [
  { k: 'rosso', l: 'Rossi', one: 'Rosso' },
  { k: 'bianco', l: 'Bianchi', one: 'Bianco' },
  { k: 'rose', l: 'Rosé', one: 'Rosé' },
  { k: 'bollicine', l: 'Bollicine', one: 'Bollicine' },
  { k: 'altro', l: 'Altro', one: 'Altro' }];
const AREAS = ['Sala', 'Bar e spina', 'Cucina', 'Cantina'];
const DAYS = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const DAYS_S = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const COLORS = ['#7B1E34', '#1F6F5C', '#B5730C', '#3E5A9C', '#8A4F9E', '#A33D2B', '#2F7D32', '#5F6B2E', '#9C3D6B', '#2C6E8F'];
const ICON = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="M13.5 6.5l4 4"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h1M20 14h1"/></svg>',
  bottle: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4h8v9c0 1.8.7 3.4 2 4.6 1.9 1.8 3 4.3 3 6.9V42a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2V24.5c0-2.6 1.1-5.1 3-6.9 1.3-1.2 2-2.8 2-4.6Z"/><path d="M15 28h18"/></svg>',
  cal: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="6" y="9" width="36" height="33" rx="4"/><path d="M6 19h36M16 4v9M32 4v9"/></svg>',
};

/* ---------- utilità ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const fmtDay = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const newVer = () => Date.now() + Math.random();
function mins(t) { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + (m || 0); }
/* Orario del locale: turni dalle 10:00 alle 02:00. La giornata di servizio cambia alle 06:00. */
const OPEN = 10 * 60, CLOSE = 26 * 60, CUTOFF = 6 * 60;
const smin = (t) => { const m = mins(t); return m < CUTOFF ? m + 1440 : m; };
const hhmm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const TIMES = []; for (let m = OPEN; m <= CLOSE; m += 30) TIMES.push(hhmm(m));
function dur(a, b) { let d = smin(b) - smin(a); if (d <= 0) d += 1440; return d; }
function serviceDate() { const d = new Date(Date.now() - CUTOFF * 60e3); d.setHours(0, 0, 0, 0); return d; }
function serviceStart() { const d = serviceDate(); d.setHours(0, CUTOFF, 0, 0); return d.getTime(); }
const serviceNow = () => Math.floor((Date.now() - serviceDate().getTime()) / 60e3);
const serviceDay = () => (serviceDate().getDay() + 6) % 7;
function validShift(st, en) {
  const a = smin(st), b = smin(en);
  if (a < OPEN || a >= CLOSE) return 'L\'inizio deve essere tra le 10:00 e l\'01:30.';
  if (b <= a) return 'La fine deve essere dopo l\'inizio.';
  if (b > CLOSE) return 'Il turno deve finire entro le 02:00.';
  return '';
}
const RES_TIMES = []; for (let m = OPEN; m < CLOSE; m += 15) RES_TIMES.push(hhmm(m));
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const fmtH = (m) => { const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h ${pad(r)}` : `${h}h`; };
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const typeOf = (k) => TYPES.find((t) => t.k === k) || TYPES[4];
const ms = (ts) => (ts && ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : 0));
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* niente */ } }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2800); }
const sortItems = (items) => [...(items || [])].sort((a, b) => a.day - b.day || smin(a.start) - smin(b.start) || String(a.staffId).localeCompare(String(b.staffId)));
const sameItems = (a, b) => JSON.stringify(sortItems(a).map(({ id, ...r }) => r)) === JSON.stringify(sortItems(b).map(({ id, ...r }) => r));
function genPassword() {
  const w = ['vino', 'birra', 'malto', 'luppolo', 'calice', 'cantina', 'botte', 'spina', 'uva', 'orzo'];
  return w[Math.floor(Math.random() * w.length)] + (100 + Math.floor(Math.random() * 900));
}
function friendlyError(e) {
  const c = (e && e.code) || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-email')) return 'Nome utente o password non corretti.';
  if (c.includes('too-many-requests')) return 'Troppi tentativi. Riprova tra qualche minuto.';
  if (c.includes('network')) return 'Nessuna connessione. Controlla internet e riprova.';
  if (c.includes('permission-denied')) return 'Non hai il permesso per questa operazione.';
  if (c.includes('requires-recent-login')) return 'Per sicurezza esci e rientra, poi riprova.';
  if (c.includes('weak-password')) return 'La password deve avere almeno 6 caratteri.';
  if (c.startsWith('functions/') && e.message) return e.message;
  if (c.includes('unavailable')) return 'Servizio non raggiungibile. Riprova tra poco.';
  return 'Operazione non riuscita. Riprova.';
}

/* ---------- Firebase ---------- */
let app, auth, db, fns, messaging = null;
if (CONFIGURED) {
  app = initializeApp(CFG.firebase);
  auth = getAuth(app);
  db = initializeFirestore(app, LOCAL ? {} : { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  fns = getFunctions(app, CFG.region || 'europe-west1');
  if (LOCAL) {
    connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, location.hostname, 8080);
    connectFunctionsEmulator(fns, location.hostname, 5001);
  }
}
const call = (name, data) => httpsCallable(fns, name)(data).then((r) => r.data);

/* ---------- stato ---------- */
const S = {
  me: null, uid: null, isAdmin: false,
  users: [], staff: [], wines: [], sales: [],
  week: null, weekKey: '', pub: null, draft: null, curKey: '', curDoc: null,
  loaded: { users: false, wines: false, sales: false, week: false, draft: false, cur: false, resToday: false, res: false },
  view: 'oggi', type: 'all',
  resToday: [], resRange: [], resDay: '', stripStart: null, unavail: {}, weather: null, q: '', staffFilter: 'all', online: navigator.onLine,
  settingUp: false, installEvt: null,
};
const userById = (id) => S.users.find((u) => u.id === id);
const colorOf = (u) => COLORS[((u && u.color) || 0) % COLORS.length];
const available = (w) => Math.max(0, (Number(w.stock) || 0) - (Number(w.sold) || 0));
const level = (w, a) => (a <= 0 ? 'bad' : a <= (Number(w.minStock) || 0) ? 'warn' : 'ok');

/* ---------- schermate di accesso ---------- */
function show(which) {
  $('#boot').hidden = which !== 'boot';
  $('#auth').hidden = which !== 'auth';
  $('#app').hidden = which !== 'app';
}
function pwdField(id, label, opts = {}) {
  return `<div class="field"><label for="${id}">${label}</label><div class="pwd">
    <input id="${id}" type="password" ${opts.autocomplete ? `autocomplete="${opts.autocomplete}"` : ''} required minlength="6" ${opts.value ? `value="${esc(opts.value)}"` : ''}>
    <button type="button" data-toggle-pwd="${id}">Mostra</button></div>${opts.hint ? `<span class="hint">${opts.hint}</span>` : ''}</div>`;
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-toggle-pwd]'); if (!t) return;
  const i = document.getElementById(t.dataset.togglePwd); i.type = i.type === 'password' ? 'text' : 'password';
  t.textContent = i.type === 'password' ? 'Mostra' : 'Nascondi';
});

function renderNotConfigured() {
  show('auth');
  $('#auth-card').innerHTML = `<h3 style="font-size:20px">App da configurare</h3>
  <p class="muted" style="margin:6px 0 0">Inserisci i dati del progetto Firebase nel file <b>config.js</b> e pubblica di nuovo l'app. Le istruzioni sono nella guida.</p>`;
}
function renderLogin(msg) {
  show('auth');
  $('#auth-card').innerHTML = `<form class="form" id="login-f">
    <h3 style="font-size:22px">Accedi</h3>
    <div class="field"><label for="l-user">Nome utente</label><input id="l-user" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required></div>
    ${pwdField('l-pass', 'Password', { autocomplete: 'current-password' })}
    <p class="err" id="l-err" ${msg ? '' : 'hidden'}>${esc(msg || '')}</p>
    <button class="btn primary block" type="submit">Entra</button>
    <p class="hint muted" style="margin:0;font-size:13px">Le credenziali te le dà l'amministratore del locale.</p></form>`;
  $('#login-f').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Accesso…';
    try {
      await signInWithEmailAndPassword(auth, emailOf($('#l-user').value), $('#l-pass').value);
    } catch (err) {
      const p = $('#l-err'); p.textContent = friendlyError(err); p.hidden = false; btn.disabled = false; btn.textContent = 'Entra';
    }
  };
}
function renderSetup() {
  show('auth');
  $('#auth-card').innerHTML = `<form class="form" id="setup-f">
    <h3 style="font-size:22px">Primo avvio</h3>
    <p class="muted" style="margin:0;font-size:14px">Crea l'account dell'amministratore. Potrai poi aggiungere lo staff dall'app.</p>
    <div class="field"><label for="su-name">Il tuo nome</label><input id="su-name" required autocomplete="name"></div>
    <div class="field"><label for="su-user">Nome utente</label><input id="su-user" required autocapitalize="none" autocorrect="off" spellcheck="false" pattern="[a-zA-Z0-9][a-zA-Z0-9._\\-]{2,29}" placeholder="es. admin"><span class="hint">3–30 caratteri: lettere, numeri, punto, trattino.</span></div>
    ${pwdField('su-pass', 'Password', { autocomplete: 'new-password', hint: 'Almeno 6 caratteri.' })}
    <p class="err" id="su-err" hidden></p>
    <button class="btn primary block" type="submit">Crea amministratore</button></form>`;
  $('#setup-f').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    const name = $('#su-name').value.trim(), username = $('#su-user').value.trim().toLowerCase();
    S.settingUp = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, emailOf(username), $('#su-pass').value);
      const b = writeBatch(db);
      b.set(doc(db, 'users', cred.user.uid), { name, username, role: 'admin', active: true, color: 0, createdAt: serverTimestamp() });
      b.set(doc(db, 'config', 'setup'), { adminUid: cred.user.uid, at: serverTimestamp() });
      await b.commit();
      S.settingUp = false; startUser(cred.user);
    } catch (err) {
      S.settingUp = false;
      const p = $('#su-err'); p.textContent = err.code === 'auth/email-already-in-use' ? 'Questo nome utente esiste già.' : friendlyError(err); p.hidden = false; btn.disabled = false;
      if (auth.currentUser) await signOut(auth).catch(() => {});
    }
  };
}
function renderInactive() {
  show('auth');
  $('#auth-card').innerHTML = `<h3 style="font-size:20px">Account non attivo</h3>
  <p class="muted" style="margin:6px 0 14px">Questo account è stato rimosso. Chiedi all'amministratore nuove credenziali.</p>
  <button class="btn block" id="out">Esci</button>`;
  $('#out').onclick = () => signOut(auth);
}

/* ---------- avvio sessione ---------- */
let unsubs = [];
const stopAll = () => { unsubs.forEach((u) => u()); unsubs = []; if (unResT) unResT(); unResT = null; if (unRes) unRes(); unRes = null; unWeek.forEach((u) => u()); unWeek = []; if (unCur) unCur(); unCur = null; if (unSales) unSales(); unSales = null; };
let unMe = null;

async function onAuth(user) {
  if (unMe) { unMe(); unMe = null; }
  stopAll();
  S.me = null; S.uid = null; S.isAdmin = false;
  if (!user) {
    show('boot');
    let setupDone = true;
    try { setupDone = (await getDoc(doc(db, 'config', 'setup'))).exists(); } catch (e) { /* offline: mostra il login */ }
    if (auth.currentUser) return;
    setupDone ? renderLogin() : renderSetup();
    return;
  }
  if (S.settingUp) return;
  startUser(user);
}
function startUser(user) {
  S.uid = user.uid;
  show('boot');
  unMe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
    if (S.settingUp) return;
    const d = snap.exists() ? snap.data() : null;
    if (!d || d.active !== true) { if (!snap.metadata.fromCache) { stopAll(); renderInactive(); } return; }
    const first = !S.me;
    S.me = { id: snap.id, ...d }; S.isAdmin = d.role === 'admin';
    if (first) startData();
    else { restartWeek(); render(); }
  }, () => renderLogin('Sessione scaduta. Accedi di nuovo.'));
}
function startData() {
  show('app');
  const p = new URLSearchParams(location.search).get('settimana');
  S.week = mondayOf(p && /^\d{4}-\d{2}-\d{2}$/.test(p) ? parseYmd(p) : serviceDate()); S.weekKey = ymd(S.week);
  unsubs.push(onSnapshot(collection(db, 'users'), (s) => {
    S.users = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    S.staff = S.users.filter((u) => u.active).sort((a, b) => a.name.localeCompare(b.name, 'it'));
    S.loaded.users = true; render(); if (usersSheet.redraw) usersSheet.redraw();
  }, onErr));
  unsubs.push(onSnapshot(collection(db, 'wines'), (s) => {
    S.wines = s.docs.map((d) => ({ id: d.id, ...d.data() })); S.loaded.wines = true; render();
  }, onErr));
  if (S.isAdmin) {
    unsubs.push(onSnapshot(collection(db, 'unavail'), (s) => { S.unavail = Object.fromEntries(s.docs.map((d) => [d.id, d.data().dates || []])); render(); }, onErr));
  } else {
    unsubs.push(onSnapshot(doc(db, 'unavail', S.uid), (s) => { S.unavail = { [S.uid]: s.exists() ? s.data().dates || [] : [] }; render(); }, onErr));
  }
  S.resDay = ymd(serviceDate()); S.stripStart = serviceDate();
  watchCurrent(); restartWeek(); restartStrip(); route(); refreshPush(); loadWeather();
}
let unCur = null, unSales = null, unWeek = [], unResT = null, unRes = null;
/* Prenotazioni della striscia di 14 giorni mostrata nella sezione Prenotazioni. */
function restartStrip() {
  if (unRes) unRes();
  const from = ymd(S.stripStart), to = ymd(addDays(S.stripStart, 13));
  const lo = S.resDay < from ? S.resDay : from, hi = S.resDay > to ? S.resDay : to;
  S.loaded.res = false;
  unRes = onSnapshot(query(collection(db, 'reservations'), where('date', '>=', lo), where('date', '<=', hi)), (s) => {
    S.resRange = s.docs.map((d) => ({ id: d.id, ...d.data() })); S.loaded.res = true; render();
  }, onErr);
}
function watchCurrent() {
  const k = ymd(mondayOf(serviceDate()));
  if (k !== S.curKey || !unCur) {
    S.curKey = k; S.curDoc = null; S.loaded.cur = false; if (unCur) unCur();
    unCur = onSnapshot(doc(db, 'shifts', k), (s) => { S.curDoc = s.exists() ? s.data() : null; S.loaded.cur = true; render(); }, onErr);
  }
  const today = ymd(serviceDate());
  if (today !== watchCurrent.resDay || !unResT) {
    watchCurrent.resDay = today; if (unResT) unResT();
    unResT = onSnapshot(query(collection(db, 'reservations'), where('date', '==', today)), (s) => {
      S.resToday = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => smin(a.time) - smin(b.time)); S.loaded.resToday = true; render();
    }, onErr);
  }
  const st = serviceStart();
  if (st !== watchCurrent.salesFrom || !unSales) {
    watchCurrent.salesFrom = st; if (unSales) unSales();
    unSales = onSnapshot(query(collection(db, 'sales'), where('at', '>=', Timestamp.fromMillis(st))), (s) => {
      S.sales = s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).sort((a, b) => ms(b.at) - ms(a.at));
      S.loaded.sales = true; render();
    }, onErr);
  }
}
function restartWeek() {
  unWeek.forEach((u) => u()); unWeek = [];
  S.pub = null; S.draft = null; S.loaded.week = false; S.loaded.draft = !S.isAdmin;
  const key = S.weekKey;
  unWeek.push(onSnapshot(doc(db, 'shifts', key), (s) => { if (key !== S.weekKey) return; S.pub = s.exists() ? s.data() : null; S.loaded.week = true; render(); }, onErr));
  if (S.isAdmin) unWeek.push(onSnapshot(doc(db, 'drafts', key), (s) => { if (key !== S.weekKey) return; S.draft = s.exists() ? s.data() : null; S.loaded.draft = true; render(); }, onErr));
}
function setWeek(d) { S.week = mondayOf(d); S.weekKey = ymd(S.week); restartWeek(); render(); }
function onErr(e) { console.warn(e); if (e && e.code === 'permission-denied') return; toast('Connessione al database interrotta. Riapri l\'app.'); }

/* ---------- scritture ---------- */
let chain = Promise.resolve();
function write(fn, okMsg) {
  const p = chain.then(fn); chain = p.catch(() => {});
  return p.then((r) => { if (okMsg) toast(okMsg); return r; }).catch((e) => { console.warn(e); toast(friendlyError(e)); throw e; });
}
/* Turni che l'amministratore sta modificando: la bozza, oppure quelli pubblicati se non c'è bozza. */
const editItems = () => (S.draft ? S.draft.items || [] : (S.pub ? S.pub.items || [] : []));
const viewItems = () => (S.isAdmin ? editItems() : (S.pub ? S.pub.items || [] : []));
function saveDraft(items, msg) {
  S.draft = { ...(S.draft || {}), items }; render();
  return write(() => setDoc(doc(db, 'drafts', S.weekKey), { items, updatedAt: serverTimestamp(), by: S.uid }), msg);
}

/* ---------- render ---------- */
function render() {
  if (!S.me) return;
  const r = $('#role');
  r.className = 'role' + (S.isAdmin ? ' admin' : '');
  r.innerHTML = `<span class="avatar" style="background:${colorOf(S.me)}">${esc(initials(S.me.name))}</span>${S.isAdmin ? 'Admin' : esc(S.me.name.split(' ')[0])}`;
  document.querySelectorAll('.nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.v === S.view ? 'page' : 'false'));
  ['oggi', 'pren', 'turni', 'cantina'].forEach((v) => { $('#v-' + v).hidden = v !== S.view; });
  const a = document.activeElement; const keep = a && a.id === 'wine-q' ? a.selectionStart : null;
  if (S.view === 'oggi') renderOggi();
  if (S.view === 'pren') renderPren();
  if (S.view === 'turni') renderTurni();
  if (S.view === 'cantina') renderCantina();
  if (keep != null) { const n = $('#wine-q'); if (n) { n.focus(); try { n.setSelectionRange(keep, keep); } catch (e) { /* */ } } }
}
const offlineNote = () => (S.online ? '' : '<div class="notice"><b>Sei offline.</b> Vedi gli ultimi dati salvati; le modifiche partono appena torna la connessione.</div>');

function shiftsForDay(i, items) { return items.filter((x) => x.day === i).sort((a, b) => smin(a.start) - smin(b.start)); }
const onDuty = (x) => x.day === serviceDay() && serviceNow() >= smin(x.start) && serviceNow() < smin(x.start) + dur(x.start, x.end);
function shiftRow(x, clickable, live) {
  const u = userById(x.staffId); const name = u ? u.name : 'Utente rimosso';
  const mine = x.staffId === S.uid;
  const tag = clickable ? 'button' : 'div';
  return `<${tag} class="shift${mine ? ' mine' : ''}" ${clickable ? `data-act="edit-shift" data-id="${esc(x.id)}"` : ''}>
    <span class="avatar" style="background:${colorOf(u)}">${esc(initials(name))}</span>
    <span class="who">${esc(name)}${mine ? ' <span class="muted" style="font-weight:500">(tu)</span>' : ''}<small>${esc(x.area || '')}${x.note ? ' · ' + esc(x.note) : ''}</small></span>
    ${live && onDuty(x) ? '<span class="pill ok">in servizio</span>' : ''}<span class="time">${esc(x.start)}–${esc(x.end)}</span></${tag}>`;
}
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function pushBanner() {
  if (lsGet('epicuro-hide-push') === '1') return '';
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  if (perm === 'granted' && lsGet('epicuro-token')) return '';
  if (isIOS() && !isStandalone()) {
    return `<div class="card banner">${ICON.bell.replace('<svg', '<svg style="width:24px;height:24px;flex:none"')}<div class="grow"><b>Installa l'app per le notifiche</b>
      Su iPhone tocca <b>Condividi</b> in Safari, poi <b>Aggiungi alla schermata Home</b>. Apri Epicuro dall'icona e attiva le notifiche.</div>
      <button class="btn sm ghost" data-act="hide-push">Chiudi</button></div>`;
  }
  if (perm === 'denied') return `<div class="card banner"><div class="grow"><b>Notifiche bloccate</b>Riattivale dalle impostazioni del telefono per questo sito, così ricevi i turni appena escono.</div><button class="btn sm ghost" data-act="hide-push">Chiudi</button></div>`;
  if (perm === 'unsupported') return '';
  return `<div class="card banner">${ICON.bell.replace('<svg', '<svg style="width:24px;height:24px;flex:none"')}<div class="grow"><b>Ricevi i turni sul telefono</b>Ti avvisiamo appena l'amministratore pubblica la settimana.</div>
    <button class="btn sm primary" data-act="push">Attiva</button></div>`;
}

function renderOggi() {
  const now = serviceDate(); const wd = serviceDay();
  const todays = S.loaded.cur ? shiftsForDay(wd, (S.curDoc && S.curDoc.items) || []) : null;
  const t0 = serviceStart();
  const salesToday = S.sales.filter((s) => ms(s.at) >= t0);
  const bottlesToday = salesToday.reduce((n, s) => n + (Number(s.qty) || 0), 0);
  const low = S.wines.map((w) => ({ w, a: available(w) })).filter((o) => level(o.w, o.a) !== 'ok').sort((a, b) => a.a - b.a);
  const next = findMyNext();
  const covers = S.resToday.reduce((n, r) => n + (Number(r.people) || 0), 0);
  $('#v-oggi').innerHTML = `${offlineNote()}
  <div class="welcome"><h2>Benvenuto, ${esc(S.me.name.split(' ')[0])}</h2>
  <p>${esc(now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }))}</p></div>
  ${weatherCard()}
  <div class="sec-h"><h2>Prenotazioni di oggi</h2><a class="eyebrow" href="#pren">Tutte →</a></div>
  <div class="card">${!S.loaded.resToday ? '<div class="empty-day">Caricamento…</div>'
    : S.resToday.length ? `<div class="pad totals" style="padding-bottom:0"><span><b>${S.resToday.length}</b> ${S.resToday.length === 1 ? 'prenotazione' : 'prenotazioni'}</span><span><b>${covers}</b> persone</span></div><div>${S.resToday.map(resRow).join('')}</div>`
      : '<div class="empty-day">Nessuna prenotazione per oggi.</div>'}
    <div class="pad" style="padding-top:4px"><button class="btn sm ale" data-act="new-res" data-date="${ymd(serviceDate())}">${ICON.plus}Prenotazione</button></div></div>
  ${pushBanner()}
  <div class="card pad"><span class="muted">Il tuo prossimo turno:</span> <b>${next ? esc(next) : (S.curDoc ? 'nessun altro turno questa settimana' : 'turni non ancora pubblicati')}</b></div>
  <div class="stats">
    <div class="card stat"><b class="num">${bottlesToday}</b><span>bottiglie vendute oggi</span></div>
    <div class="card stat ${low.some((o) => o.a > 0) ? 'warn' : ''}"><b class="num">${low.filter((o) => o.a > 0).length}</b><span>vini sotto scorta</span></div>
    <div class="card stat ${low.some((o) => o.a <= 0) ? 'bad' : ''}"><b class="num">${low.filter((o) => o.a <= 0).length}</b><span>vini esauriti</span></div>
  </div>
  <div class="sec-h"><h2>In turno oggi</h2><a class="eyebrow" href="#turni">Settimana →</a></div>
  <div class="card">${todays === null ? '<div class="empty-day">Caricamento…</div>'
    : (todays.length ? `<div class="shifts">${todays.map((x) => shiftRow(x, false, true)).join('')}</div>`
      : `<div class="empty-day">${S.curDoc ? 'Nessuno in turno oggi.' : 'Turni non ancora pubblicati.'}</div>`)}</div>
  <div class="sec-h"><h2>Da riordinare</h2><a class="eyebrow" href="#cantina">Cantina →</a></div>
  <div class="card pad">${low.length ? `<div class="list">${low.slice(0, 8).map(({ w, a }) => `
    <div class="li"><span class="dot t-${esc(w.type || 'altro')}"></span><div class="grow">${esc(w.name)}<small>${esc(w.producer || typeOf(w.type).one)}</small></div>
    <span class="pill ${level(w, a)}">${a <= 0 ? 'Esaurito' : a + ' rimaste'}</span></div>`).join('')}</div>`
    : `<span class="muted">${S.wines.length ? 'Tutte le scorte sono sopra il minimo.' : 'Nessun vino in cantina.'}</span>`}</div>
  <div class="sec-h"><h2>Vendite di oggi</h2><span class="eyebrow num">${salesToday.length} registrazioni</span></div>
  <div class="card pad">${salesToday.length ? `<div class="list">${salesToday.slice(0, 15).map(saleRow).join('')}</div>` : '<span class="muted">Nessuna bottiglia segnalata oggi.</span>'}</div>`;
}
function findMyNext() {
  if (!S.curDoc) return null;
  const wd = serviceDay(), nm = serviceNow();
  const mine = sortItems((S.curDoc.items || []).filter((x) => x.staffId === S.uid));
  const n = mine.find((x) => x.day > wd || (x.day === wd && smin(x.start) + dur(x.start, x.end) > nm));
  if (!n) return null;
  if (n.day === wd && smin(n.start) <= nm) return `adesso, fino alle ${n.end}`;
  return `${n.day === wd ? 'oggi' : DAYS[n.day]} ${n.start}–${n.end}`;
}
function saleRow(s) {
  const w = S.wines.find((x) => x.id === s.wineId);
  const t = new Date(ms(s.at)); const u = userById(s.by);
  const mine = s.by === S.uid;
  const canUndo = S.isAdmin || (mine && Date.now() - ms(s.at) < 29 * 60e3);
  return `<div class="li"><span class="dot t-${esc(w ? w.type : (s.wineType || 'altro'))}"></span>
  <div class="grow">${esc(w ? w.name : (s.wineName || 'Vino rimosso'))}<small><span class="num">${pad(t.getHours())}:${pad(t.getMinutes())}</span> · ${mine ? 'tu' : esc(u ? u.name : 'staff')}</small></div>
  <span class="pill num">−${Number(s.qty) || 1}</span>
  ${canUndo ? `<button class="btn sm ghost" data-act="undo-sale" data-id="${esc(s.id)}">Annulla</button>` : ''}</div>`;
}

function renderTurni() {
  const mon = S.week; const sun = addDays(mon, 6);
  const todayKey = ymd(serviceDate());
  const thisWeek = S.curKey === S.weekKey;
  const items = viewItems();
  const loaded = S.loaded.week && S.loaded.draft;
  const filt = S.staffFilter;
  const hours = {}; items.forEach((x) => { hours[x.staffId] = (hours[x.staffId] || 0) + dur(x.start, x.end); });
  let bar = '';
  if (S.isAdmin && loaded) {
    const dirty = S.draft ? !sameItems(S.draft.items, S.pub ? S.pub.items : []) : false;
    const when = S.pub && S.pub.publishedAt ? new Date(ms(S.pub.publishedAt)).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    if (S.pub && !dirty) {
      bar = `<div class="card pubbar live"><div class="txt"><b>Pubblicati</b>Lo staff vede questi turni dal ${esc(when)}.</div>
        <button class="btn sm ghost" data-act="unpublish">Ritira</button></div>`;
    } else if (items.length || S.pub) {
      bar = `<div class="card pubbar draft"><div class="txt"><b>${S.pub ? 'Modifiche non pubblicate' : 'Bozza non pubblicata'}</b>${S.pub ? 'Lo staff vede ancora la versione precedente.' : 'Lo staff non vede ancora questi turni.'}</div>
        ${S.pub ? '<button class="btn sm ghost" data-act="unpublish">Ritira</button>' : ''}<button class="btn sm primary" data-act="publish" ${items.length ? '' : 'disabled'}>${ICON.send}Pubblica</button></div>`;
    }
  }
  $('#v-turni').innerHTML = `${offlineNote()}
  <div class="weekbar">
    <button class="icon-btn" data-act="week" data-d="-7" aria-label="Settimana precedente">${ICON.left}</button>
    <div class="lbl"><b>${fmtDay(mon)} – ${fmtDay(sun)}</b><span>${thisWeek ? 'Questa settimana' : '<button class="btn sm ghost" data-act="week" data-d="0" style="min-height:24px;padding:0 6px">Torna a questa settimana</button>'}</span></div>
    <button class="icon-btn" data-act="week" data-d="7" aria-label="Settimana successiva">${ICON.right}</button>
  </div>
  ${bar}
  ${S.isAdmin ? `<div class="row-actions">
    <button class="btn sm ale" data-act="new-shift" data-day="${thisWeek ? serviceDay() : 0}">${ICON.plus}Turno</button>
    <button class="btn sm" data-act="copy-week">${ICON.copy}Copia sett. prec.</button>
    <button class="btn sm" data-act="clear-week" ${items.length ? '' : 'disabled'}>${ICON.trash}Svuota</button>
    <button class="btn sm" data-act="users">${ICON.users}Utenti</button>
    <button class="btn sm" data-act="unavail">${ICON.cal.replace('viewBox="0 0 48 48"', 'viewBox="0 0 48 48" style="width:18px;height:18px"')}Mie indisponibilità</button></div>`
    : `<div class="row-actions"><button class="btn sm" data-act="unavail">${ICON.cal.replace('viewBox="0 0 48 48"', 'viewBox="0 0 48 48" style="width:18px;height:18px"')}Segna i giorni in cui non ci sei</button></div>`}
  ${!S.isAdmin && loaded && !S.pub ? `<div class="card empty">${ICON.cal}<h3>Turni non ancora pubblicati</h3><p>Riceverai una notifica appena l'amministratore pubblica questa settimana.</p></div>` : ''}
  ${(S.isAdmin || S.pub) && S.staff.length > 1 ? `<div class="chips" role="group" aria-label="Filtra per persona">
    <button class="chip" data-act="sfilter" data-id="all" aria-pressed="${filt === 'all'}">Tutti</button>
    <button class="chip" data-act="sfilter" data-id="${esc(S.uid)}" aria-pressed="${filt === S.uid}">I miei</button>
    ${S.staff.filter((u) => u.id !== S.uid).map((u) => `<button class="chip" data-act="sfilter" data-id="${esc(u.id)}" aria-pressed="${filt === u.id}"><span class="dot" style="background:${colorOf(u)}"></span>${esc(u.name)}</button>`).join('')}</div>` : ''}
  ${S.isAdmin || S.pub ? `<div class="days">${DAYS.map((d, i) => {
    const date = addDays(mon, i); const list = shiftsForDay(i, items).filter((x) => filt === 'all' || x.staffId === filt);
    const isToday = ymd(date) === todayKey;
    return `<div class="card day${isToday ? ' today' : ''}">
      <div class="day-h"><div class="d"><b>${d}</b><span>${fmtDay(date)}</span>${isToday ? '<span class="today-tag">Oggi</span>' : ''}</div>
      ${S.isAdmin ? `<button class="icon-btn" data-act="new-shift" data-day="${i}" aria-label="Aggiungi turno ${d}">${ICON.plus}</button>` : ''}</div>
      ${list.length ? `<div class="shifts">${list.map((x) => shiftRow(x, S.isAdmin, thisWeek)).join('')}</div>` : `<div class="empty-day">${loaded ? 'Riposo' : 'Caricamento…'}</div>`}
      ${unavLine(ymd(date))}
    </div>`;
  }).join('')}</div>` : ''}
  ${items.length ? `<div class="sec-h"><h2>Ore della settimana</h2></div>
  <div class="card pad"><div class="hours">${Object.keys(hours).sort((a, b) => hours[b] - hours[a]).map((id) => { const u = userById(id); return `
    <span style="display:flex;align-items:center;gap:10px"><span class="avatar" style="background:${colorOf(u)}">${esc(initials(u ? u.name : '?'))}</span>${esc(u ? u.name : 'Utente rimosso')}</span><span class="h">${fmtH(hours[id])}</span>`; }).join('')}</div></div>` : ''}`;
}

function renderCantina() {
  const q = S.q.trim().toLowerCase();
  const counts = { all: S.wines.length }; TYPES.forEach((t) => { counts[t.k] = S.wines.filter((w) => (w.type || 'altro') === t.k).length; });
  let list = S.wines.map((w) => ({ w, a: available(w) }));
  if (S.type === 'low') list = list.filter((o) => level(o.w, o.a) !== 'ok');
  else if (S.type !== 'all') list = list.filter((o) => (o.w.type || 'altro') === S.type);
  if (q) list = list.filter((o) => [o.w.name, o.w.producer, o.w.region].join(' ').toLowerCase().includes(q));
  const ti = (w) => TYPES.findIndex((t) => t.k === (w.type || 'altro'));
  list.sort((a, b) => ti(a.w) - ti(b.w) || a.w.name.localeCompare(b.w.name, 'it'));
  const total = S.wines.reduce((n, w) => n + available(w), 0);
  const lowN = S.wines.filter((w) => level(w, available(w)) !== 'ok').length;
  $('#v-cantina').innerHTML = `${offlineNote()}
  <div class="sec-h"><h2>Cantina</h2><span class="eyebrow num">${total} bottiglie in magazzino</span></div>
  ${S.isAdmin ? `<div class="row-actions"><button class="btn sm ale" data-act="new-wine">${ICON.plus}Vino</button><button class="btn sm" data-act="import">${ICON.list}Importa lista</button></div>` : ''}
  <label class="search">${ICON.search}<input id="wine-q" type="search" placeholder="Cerca vino, cantina, regione" value="${esc(S.q)}" autocomplete="off" aria-label="Cerca"></label>
  <div class="chips" role="group" aria-label="Filtra per tipo">
    <button class="chip" data-act="tfilter" data-k="all" aria-pressed="${S.type === 'all'}">Tutti <span class="ct num">${counts.all}</span></button>
    ${TYPES.filter((t) => counts[t.k] || t.k !== 'altro').map((t) => `<button class="chip" data-act="tfilter" data-k="${t.k}" aria-pressed="${S.type === t.k}"><span class="dot t-${t.k}"></span>${t.l} <span class="ct num">${counts[t.k]}</span></button>`).join('')}
    <button class="chip" data-act="tfilter" data-k="low" aria-pressed="${S.type === 'low'}">Da riordinare <span class="ct num">${lowN}</span></button>
  </div>
  ${!S.loaded.wines ? '<div class="card empty"><p>Caricamento della cantina…</p></div>'
    : !S.wines.length ? `<div class="card empty">${ICON.bottle}<h3>La cantina è vuota</h3><p>${S.isAdmin ? 'Aggiungi i vini uno alla volta oppure incolla tutta la carta con "Importa lista".' : 'L\'amministratore non ha ancora inserito i vini.'}</p>${S.isAdmin ? `<div class="row-actions" style="justify-content:center"><button class="btn primary" data-act="import">${ICON.list}Importa lista</button><button class="btn" data-act="new-wine">${ICON.plus}Un vino</button></div>` : ''}</div>`
      : !list.length ? '<div class="card empty"><p>Nessun vino corrisponde alla ricerca.</p></div>'
        : `<div class="wines">${list.map(({ w, a }) => { const lv = level(w, a); return `
    <article class="card wine">
      <span class="bar t-${esc(w.type || 'altro')}"></span>
      <div class="info"><div class="name">${esc(w.name)}</div>
        <div class="meta">${esc([w.producer, w.region].filter(Boolean).join(' · ') || typeOf(w.type).one)}</div>
        <div class="tags"><span class="pill">${typeOf(w.type).one}</span>${lv === 'bad' ? '<span class="pill bad">Esaurito</span>' : lv === 'warn' ? '<span class="pill warn">Sotto scorta</span>' : ''}${S.isAdmin && w.minStock ? `<span class="pill num">min ${Number(w.minStock)}</span>` : ''}</div></div>
      <div class="side"><div class="qty ${lv === 'ok' ? '' : lv} num"><b>${a}</b><small>${a === 1 ? 'bottiglia' : 'bottiglie'}</small></div>
        <div class="btns">${S.isAdmin ? `<button class="icon-btn" data-act="edit-wine" data-id="${esc(w.id)}" aria-label="Modifica ${esc(w.name)}">${ICON.edit}</button>` : ''}
        <button class="btn sm primary" data-act="sell" data-id="${esc(w.id)}" ${a <= 0 ? 'disabled' : ''}>Venduta</button></div></div>
    </article>`; }).join('')}</div>`}`;
}
document.addEventListener('input', (e) => { if (e.target.id === 'wine-q') { S.q = e.target.value; render(); } });

/* ---------- fogli ---------- */
function openSheet(html, after) {
  $('#sheet-body').innerHTML = '<div class="grab"></div>' + html; $('#sheet').hidden = false;
  document.body.style.overflow = 'hidden'; if (after) after($('#sheet-body'));
  const f = $('#sheet-body').querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 60);
}
function closeSheet() { $('#sheet').hidden = true; document.body.style.overflow = ''; $('#sheet-body').innerHTML = ''; usersSheet.redraw = null; }
function armButton(btn, label, fn) {
  if (btn.classList.contains('armed')) { btn.classList.remove('armed'); return fn(); }
  btn.classList.add('armed'); const old = btn.innerHTML; btn.textContent = label;
  setTimeout(() => { if (btn.isConnected && btn.classList.contains('armed')) { btn.classList.remove('armed'); btn.innerHTML = old; } }, 3500);
  return null;
}
async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); toast('Copiato'); }
  catch (e) { const el = btn && btn.closest('.sheet') ? btn.closest('.sheet').querySelector('.cred') : null; if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast('Tieni premuto sul testo per copiarlo'); }
}

function sellSheet(w) {
  const a = available(w); let q = 1;
  openSheet(`<h3>${esc(w.name)}</h3><p class="sub">${esc([w.producer, typeOf(w.type).one].filter(Boolean).join(' · '))} — <span class="num">${a}</span> in magazzino</p>
  <div class="eyebrow">Bottiglie vendute</div>
  <div class="stepper"><button type="button" id="q-minus" aria-label="Meno">−</button><output id="q-out" class="num">1</output><button type="button" id="q-plus" aria-label="Più">+</button></div>
  <div class="sheet-actions"><button class="btn" data-close>Annulla</button><button class="btn primary" id="q-ok">Conferma vendita</button></div>`, (el) => {
    const out = el.querySelector('#q-out');
    const upd = () => { out.textContent = q; el.querySelector('#q-minus').disabled = q <= 1; el.querySelector('#q-plus').disabled = q >= Math.min(a, 24); }; upd();
    el.querySelector('#q-minus').onclick = () => { q = Math.max(1, q - 1); upd(); };
    el.querySelector('#q-plus').onclick = () => { q = Math.min(a, 24, q + 1); upd(); };
    el.querySelector('#q-ok').onclick = (e) => {
      e.target.disabled = true;
      const b = writeBatch(db);
      b.set(doc(collection(db, 'sales')), { wineId: w.id, wineName: w.name, wineType: w.type || 'altro', qty: q, ver: Number(w.stockSetAt) || 0, by: S.uid, at: serverTimestamp() });
      b.update(doc(db, 'wines', w.id), { sold: increment(q) });
      // Con poca rete la conferma arriva dopo: il foglio si chiude subito, la vendita resta in coda.
      write(() => b.commit(), S.online ? `Registrata: −${q} ${w.name}` : null).catch(() => {});
      if (!S.online) toast(`Registrata offline: −${q} ${w.name}`);
      closeSheet();
    };
  });
}
function undoSale(s) {
  const w = S.wines.find((x) => x.id === s.wineId);
  const b = writeBatch(db);
  b.delete(doc(db, 'sales', s.id));
  if (w && Number(w.stockSetAt) === Number(s.ver)) b.update(doc(db, 'wines', w.id), { sold: increment(-(Number(s.qty) || 1)) });
  return write(() => b.commit(), 'Vendita annullata').catch(() => {});
}

function wineSheet(w) {
  const isNew = !w; w = w || { type: 'rosso', minStock: 2 };
  const a = isNew ? 0 : available(w);
  openSheet(`<h3>${isNew ? 'Nuovo vino' : 'Modifica vino'}</h3><p class="sub">${isNew ? 'Inserisci il vino e la quantità in magazzino.' : 'La quantità che salvi diventa il nuovo conteggio di magazzino.'}</p>
  <form class="form" id="wf">
    <div class="field"><label for="w-name">Nome del vino</label><input id="w-name" required value="${esc(w.name || '')}" ${isNew ? 'autofocus' : ''} placeholder="es. Barbera d'Asti Superiore"></div>
    <div class="two"><div class="field"><label for="w-prod">Cantina</label><input id="w-prod" value="${esc(w.producer || '')}"></div>
    <div class="field"><label for="w-reg">Regione</label><input id="w-reg" value="${esc(w.region || '')}"></div></div>
    <div class="field"><label>Tipologia</label><div class="seg" id="w-type">${TYPES.map((t) => `<button type="button" data-k="${t.k}" aria-pressed="${(w.type || 'altro') === t.k}">${t.one}</button>`).join('')}</div></div>
    <div class="two"><div class="field"><label for="w-stock">Bottiglie in magazzino</label><input id="w-stock" type="number" inputmode="numeric" min="0" step="1" value="${a}"></div>
    <div class="field"><label for="w-min">Avvisa sotto</label><input id="w-min" type="number" inputmode="numeric" min="0" step="1" value="${Number(w.minStock) || 0}"><span class="hint">Scorta minima</span></div></div>
    <div class="sheet-actions"><button type="button" class="btn" data-close>Annulla</button><button class="btn primary" type="submit">Salva</button></div>
    ${isNew ? '' : '<button type="button" class="btn danger block" id="w-del">Elimina vino</button>'}
  </form>`, (el) => {
    let type = w.type || 'altro';
    el.querySelectorAll('#w-type button').forEach((b) => { b.onclick = () => { type = b.dataset.k; el.querySelectorAll('#w-type button').forEach((x) => x.setAttribute('aria-pressed', x === b)); }; });
    el.querySelector('#wf').onsubmit = (e) => {
      e.preventDefault();
      const name = el.querySelector('#w-name').value.trim(); if (!name) return;
      const stockIn = Math.max(0, parseInt(el.querySelector('#w-stock').value, 10) || 0);
      const data = { name, producer: el.querySelector('#w-prod').value.trim(), region: el.querySelector('#w-reg').value.trim(), type,
        minStock: Math.max(0, parseInt(el.querySelector('#w-min').value, 10) || 0), updatedAt: serverTimestamp() };
      if (isNew || stockIn !== a) Object.assign(data, { stock: stockIn, sold: 0, stockSetAt: newVer() });
      const ref = isNew ? doc(collection(db, 'wines')) : doc(db, 'wines', w.id);
      write(() => (isNew ? setDoc(ref, data) : updateDoc(ref, data)), isNew ? 'Vino aggiunto' : 'Vino aggiornato').catch(() => {});
      closeSheet();
    };
    const del = el.querySelector('#w-del');
    if (del) del.onclick = () => armButton(del, 'Tocca di nuovo per eliminare', () => { write(() => deleteDoc(doc(db, 'wines', w.id)), 'Vino eliminato').catch(() => {}); closeSheet(); });
  });
}
function parseType(s) {
  s = (s || '').toLowerCase();
  if (/boll|spum|prosec|franciac|trento|champ|metodo|brut|cava/.test(s)) return 'bollicine';
  if (/ros[eèé]|rosato|cerasuolo|chiaretto/.test(s)) return 'rose';
  if (/bianc|white/.test(s)) return 'bianco';
  if (/ross|red/.test(s)) return 'rosso';
  return null;
}
function importSheet() {
  openSheet(`<h3>Importa lista vini</h3><p class="sub">Incolla un vino per riga. Separa i campi con punto e virgola: <b>Nome ; Cantina ; Tipo ; Regione ; Bottiglie</b>. Solo il nome è obbligatorio.</p>
  <form class="form" id="imf">
    <div class="field"><label>Tipo per le righe senza tipo</label><div class="seg" id="im-type">${TYPES.slice(0, 4).map((t, i) => `<button type="button" data-k="${t.k}" aria-pressed="${i === 0}">${t.one}</button>`).join('')}</div></div>
    <div class="field"><label for="im-text">Lista</label><textarea id="im-text" placeholder="Barbera d'Asti ; Cascina Esempio ; Rosso ; Piemonte ; 12&#10;Lugana ; Cantina Esempio ; Bianco ; Lombardia ; 6&#10;Franciacorta Brut ; ; Bollicine ; ; 4"></textarea>
    <span class="hint" id="im-hint">0 vini pronti</span></div>
    <div class="field"><label for="im-min">Scorta minima per tutti</label><input id="im-min" type="number" inputmode="numeric" min="0" value="2"></div>
    <div class="sheet-actions"><button type="button" class="btn" data-close>Annulla</button><button class="btn primary" type="submit" id="im-go" disabled>Importa</button></div>
  </form>`, (el) => {
    let def = 'rosso';
    el.querySelectorAll('#im-type button').forEach((b) => { b.onclick = () => { def = b.dataset.k; el.querySelectorAll('#im-type button').forEach((x) => x.setAttribute('aria-pressed', x === b)); }; });
    const ta = el.querySelector('#im-text'), hint = el.querySelector('#im-hint'), go = el.querySelector('#im-go');
    const parse = () => ta.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const p = l.split(/[;\t|]/).map((x) => x.trim());
      const last = p.length > 1 && /^\d+$/.test(p[p.length - 1]) ? parseInt(p[p.length - 1], 10) : 0;
      return { name: p[0], producer: p[1] && !/^\d+$/.test(p[1]) ? p[1] : '', type: parseType(p[2]) || parseType(p[0]) || def, region: p[3] && !/^\d+$/.test(p[3]) ? p[3] : '', stock: last };
    }).filter((r) => r.name);
    ta.oninput = () => { const n = parse().length; hint.textContent = `${n} ${n === 1 ? 'vino pronto' : 'vini pronti'}`; go.disabled = !n; };
    el.querySelector('#imf').onsubmit = async (e) => {
      e.preventDefault(); go.disabled = true; go.textContent = 'Importazione…';
      const rows = parse(); const min = Math.max(0, parseInt(el.querySelector('#im-min').value, 10) || 0);
      try {
        for (let i = 0; i < rows.length; i += 400) {
          const b = writeBatch(db);
          rows.slice(i, i + 400).forEach((r) => b.set(doc(collection(db, 'wines')), { ...r, sold: 0, minStock: min, stockSetAt: newVer(), updatedAt: serverTimestamp() }));
          await write(() => b.commit());
        }
        toast(`${rows.length} vini importati`); closeSheet();
      } catch (err) { go.disabled = false; go.textContent = 'Importa'; }
    };
  });
}

function timeOpts(sel, list) {
  if (sel && !list.includes(sel)) list = [sel, ...list];
  return list.map((t) => `<option value="${t}" ${t === sel ? 'selected' : ''}>${t}${smin(t) >= 1440 ? ' (notte)' : ''}</option>`).join('');
}
function shiftSheet(x, day) {
  const isNew = !x;
  if (!S.staff.length) { toast('Aggiungi prima gli utenti dello staff'); usersSheet(); return; }
  x = x || { day: day || 0, start: '18:00', end: '02:00', area: AREAS[0], staffId: S.staff[0].id };
  openSheet(`<h3>${isNew ? 'Nuovo turno' : 'Modifica turno'}</h3><p class="sub">Settimana dal ${fmtDay(S.week)}</p>
  <form class="form" id="sf">
    <div class="field"><label for="s-staff">Persona</label><select id="s-staff">${S.staff.map((u) => `<option value="${esc(u.id)}" ${u.id === x.staffId ? 'selected' : ''}>${esc(u.name)}${isUnavail(u.id, ymd(addDays(S.week, x.day))) ? ' — non disponibile' : ''}</option>`).join('')}</select></div>
    <div class="field"><label>Giorno</label><div class="seg days7" id="s-day">${DAYS_S.map((d, i) => `<button type="button" data-d="${i}" aria-pressed="${i === x.day}">${d}</button>`).join('')}</div></div>
    <div class="two"><div class="field"><label for="s-start">Inizio</label><select id="s-start">${timeOpts(x.start, TIMES.slice(0, -1))}</select></div>
    <div class="field"><label for="s-end">Fine</label><select id="s-end">${timeOpts(x.end, TIMES.slice(1))}</select></div></div>
    <p class="hint" style="margin:-4px 0 0">Orario turni: dalle 10:00 alle 02:00. <span id="s-len" class="num"></span></p>
    <p class="err" id="s-err" hidden></p>
    <p class="notice" id="s-unav" hidden></p>
    <div class="field"><label for="s-area">Postazione</label><select id="s-area">${AREAS.map((a) => `<option ${a === x.area ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
    <div class="field"><label for="s-note">Nota (facoltativa)</label><input id="s-note" value="${esc(x.note || '')}" placeholder="es. apertura, chiusura cassa"></div>
    ${isNew ? `<label class="check"><input type="checkbox" id="s-more"> Aggiungi lo stesso turno anche in altri giorni</label>
    <div class="seg days7" id="s-days" hidden>${DAYS_S.map((d, i) => `<button type="button" data-d="${i}" aria-pressed="false">${d}</button>`).join('')}</div>` : ''}
    <div class="sheet-actions"><button type="button" class="btn" data-close>Annulla</button><button class="btn primary" type="submit">Salva turno</button></div>
    ${isNew ? '' : '<button type="button" class="btn danger block" id="s-del">Elimina turno</button>'}
  </form>`, (el) => {
    let d = x.day; const extra = new Set();
    const st = el.querySelector('#s-start'), en = el.querySelector('#s-end'), len = el.querySelector('#s-len'), pe = el.querySelector('#s-err');
    const chk = () => { const er = validShift(st.value, en.value); pe.textContent = er; pe.hidden = !er; len.textContent = er ? '' : 'Durata: ' + fmtH(dur(st.value, en.value)); };
    st.onchange = () => { if (smin(en.value) <= smin(st.value)) { const i = TIMES.indexOf(st.value); en.value = TIMES[Math.min(TIMES.length - 1, i + 8)]; } chk(); };
    en.onchange = chk; chk();
    const who = el.querySelector('#s-staff'), un = el.querySelector('#s-unav');
    const chkU = () => {
      const days = new Set([d]); if (el.querySelector('#s-more') && el.querySelector('#s-more').checked) extra.forEach((k) => days.add(k));
      const bad = [...days].sort().filter((k) => isUnavail(who.value, ymd(addDays(S.week, k))));
      const u = userById(who.value);
      un.textContent = bad.length ? `${u ? u.name : 'Questa persona'} ha segnato come non disponibile: ${bad.map((k) => DAYS[k]).join(', ')}.` : ''; un.hidden = !bad.length;
    };
    who.onchange = chkU;
    el.querySelectorAll('#s-day button').forEach((b) => { b.onclick = () => { d = +b.dataset.d; el.querySelectorAll('#s-day button').forEach((z) => z.setAttribute('aria-pressed', z === b)); chkU(); }; });
    el.addEventListener('click', (ev) => { if (ev.target.closest('#s-days button')) setTimeout(chkU); });
    el.addEventListener('change', (ev) => { if (ev.target.id === 's-more') chkU(); });
    chkU();
    const more = el.querySelector('#s-more');
    if (more) {
      more.onchange = () => { el.querySelector('#s-days').hidden = !more.checked; };
      el.querySelectorAll('#s-days button').forEach((b) => { b.onclick = () => { const k = +b.dataset.d; extra.has(k) ? extra.delete(k) : extra.add(k); b.setAttribute('aria-pressed', extra.has(k)); }; });
    }
    el.querySelector('#sf').onsubmit = (e) => {
      e.preventDefault();
      const er = validShift(st.value, en.value); if (er) { pe.textContent = er; pe.hidden = false; return; }
      const base = { staffId: el.querySelector('#s-staff').value, start: st.value, end: en.value, area: el.querySelector('#s-area').value, note: el.querySelector('#s-note').value.trim() };
      const items = [...editItems()];
      if (isNew) { const days = new Set([d]); if (more && more.checked) extra.forEach((k) => days.add(k)); days.forEach((k) => items.push({ id: rid(), day: k, ...base })); }
      else { const i = items.findIndex((y) => y.id === x.id); if (i >= 0) items[i] = { ...items[i], ...base, day: d }; }
      saveDraft(items, isNew ? 'Turno aggiunto alla bozza' : 'Turno aggiornato').catch(() => {});
      closeSheet();
    };
    const del = el.querySelector('#s-del');
    if (del) del.onclick = () => armButton(del, 'Tocca di nuovo per eliminare', () => { saveDraft(editItems().filter((y) => y.id !== x.id), 'Turno eliminato').catch(() => {}); closeSheet(); });
  });
}
async function copyWeek(btn) {
  const prevKey = ymd(addDays(S.week, -7));
  const go = async () => {
    try {
      const [pd, pp] = await Promise.all([getDoc(doc(db, 'drafts', prevKey)), getDoc(doc(db, 'shifts', prevKey))]);
      const prev = pp.exists() ? pp.data().items || [] : (pd.exists() ? pd.data().items || [] : []);
      const items = prev.filter((x) => { const u = userById(x.staffId); return u && u.active; });
      if (!items.length) { toast('La settimana precedente non ha turni'); return; }
      await saveDraft(items.map((x) => ({ ...x, id: rid() })), `${items.length} turni copiati nella bozza`);
    } catch (e) { toast(friendlyError(e)); }
  };
  if (editItems().length) armButton(btn, 'Sostituisce i turni: tocca ancora', go); else go();
}
function clearWeek(btn) {
  armButton(btn, 'Svuota tutto: tocca ancora', () => saveDraft([], S.pub ? 'Bozza svuotata: pubblica per aggiornare lo staff' : 'Settimana svuotata').catch(() => {}));
}
function publishSheet() {
  const items = editItems(); const people = new Set(items.map((x) => x.staffId));
  openSheet(`<h3>Pubblica i turni</h3><p class="sub">Settimana ${fmtDay(S.week)} – ${fmtDay(addDays(S.week, 6))}</p>
  <dl class="kv"><dt>Turni</dt><dd class="num">${items.length}</dd><dt>Persone</dt><dd class="num">${people.size}</dd><dt>Ore totali</dt><dd class="num">${fmtH(items.reduce((n, x) => n + dur(x.start, x.end), 0))}</dd></dl>
  <div class="hr"></div>
  <label class="check"><input type="checkbox" id="p-notify" checked> Invia una notifica allo staff</label>
  <p class="hint muted" style="margin:0;font-size:13px">Ognuno riceve sul telefono i propri turni della settimana.</p>
  <div class="sheet-actions"><button class="btn" data-close>Annulla</button><button class="btn primary" id="p-go">${ICON.send}Pubblica</button></div>`, (el) => {
    el.querySelector('#p-go').onclick = (e) => {
      e.currentTarget.disabled = true;
      const notify = el.querySelector('#p-notify').checked;
      const b = writeBatch(db);
      b.set(doc(db, 'shifts', S.weekKey), { items, publishedAt: serverTimestamp(), publishedBy: S.uid, notify });
      b.set(doc(db, 'drafts', S.weekKey), { items, updatedAt: serverTimestamp(), by: S.uid });
      write(() => b.commit(), notify ? 'Turni pubblicati, notifica inviata' : 'Turni pubblicati').catch(() => {});
      closeSheet();
    };
  });
}
function unpublish(btn) {
  armButton(btn, 'Ritira: tocca ancora', () => {
    const b = writeBatch(db);
    b.set(doc(db, 'drafts', S.weekKey), { items: editItems(), updatedAt: serverTimestamp(), by: S.uid });
    b.delete(doc(db, 'shifts', S.weekKey));
    write(() => b.commit(), 'Pubblicazione ritirata: lo staff non vede più questa settimana').catch(() => {});
  });
}

/* ---------- utenti (amministratore) ---------- */
function usersSheet() {
  const draw = (el) => {
    el.querySelector('#u-list').innerHTML = S.staff.map((u) => `<div class="li"><span class="avatar" style="background:${colorOf(u)}">${esc(initials(u.name))}</span>
      <div class="grow">${esc(u.name)}${u.id === S.uid ? ' <span class="muted">(tu)</span>' : ''}<small>${esc(u.username || '')} · ${u.role === 'admin' ? 'Amministratore' : 'Staff'}</small></div>
      ${u.id === S.uid ? '' : `<button type="button" class="btn sm" data-u-pass="${esc(u.id)}">Password</button><button type="button" class="btn sm danger" data-u-del="${esc(u.id)}">Rimuovi</button>`}</div>`).join('');
    el.querySelectorAll('[data-u-pass]').forEach((b) => { b.onclick = () => passwordSheet(userById(b.dataset.uPass)); });
    el.querySelectorAll('[data-u-del]').forEach((b) => {
      b.onclick = () => armButton(b, 'Conferma', async () => {
        b.disabled = true;
        try { await call('removeStaff', { uid: b.dataset.uDel }); toast('Utente rimosso'); } catch (e) { toast(friendlyError(e)); b.disabled = false; }
      });
    });
  };
  openSheet(`<h3>Utenti</h3><p class="sub">Chi può entrare nell'app. Le credenziali le comunichi tu a ciascuno.</p>
  <button type="button" class="btn block" data-act="qr" style="margin-bottom:10px">${ICON.qr}QR per scaricare l'app</button>
  <div class="list" id="u-list"></div>
  <div class="hr" style="margin:14px 0 10px"></div>
  <form class="form" id="uf">
    <div class="eyebrow">Nuovo utente</div>
    <div class="field"><label for="u-name">Nome e cognome</label><input id="u-name" required placeholder="es. Giulia Rossi" autocomplete="off"></div>
    <div class="two"><div class="field"><label for="u-user">Nome utente</label><input id="u-user" required autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="es. giulia" autocomplete="off"></div>
    <div class="field"><label for="u-role">Ruolo</label><select id="u-role"><option value="staff">Staff</option><option value="admin">Amministratore</option></select></div></div>
    ${pwdField('u-pass', 'Password', { autocomplete: 'new-password', value: genPassword(), hint: 'Almeno 6 caratteri. Ne abbiamo proposta una: puoi cambiarla.' })}
    <p class="err" id="u-err" hidden></p>
    <div class="sheet-actions"><button type="button" class="btn" data-close>Chiudi</button><button class="btn primary" type="submit">${ICON.plus}Crea utente</button></div>
  </form>`, (el) => {
    draw(el); usersSheet.redraw = () => { if (!$('#sheet').hidden && el.querySelector('#u-list')) draw(el); };
    const nameI = el.querySelector('#u-name'), userI = el.querySelector('#u-user');
    nameI.oninput = () => { if (!userI.dataset.touched) userI.value = nameI.value.trim().split(/\s+/)[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9._-]/g, ''); };
    userI.oninput = () => { userI.dataset.touched = '1'; };
    el.querySelector('#uf').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type=submit]'); const pe = el.querySelector('#u-err'); pe.hidden = true;
      const data = { name: nameI.value.trim(), username: userI.value.trim().toLowerCase(), role: el.querySelector('#u-role').value, password: el.querySelector('#u-pass').value };
      let er = '';
      if (!data.name) er = 'Scrivi il nome della persona.';
      else if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(data.username)) er = 'Il nome utente deve avere 3–30 caratteri: lettere, numeri, punto, trattino.';
      else if (data.password.length < 6) er = 'La password deve avere almeno 6 caratteri.';
      else if (S.users.some((u) => u.active && u.username === data.username)) er = `Il nome utente "${data.username}" è già usato.`;
      if (er) { pe.textContent = er; pe.hidden = false; return; }
      btn.disabled = true; btn.textContent = 'Creazione…';
      try { await call('createStaff', data); credSheet(data.name, data.username, data.password, true); }
      catch (err) { pe.textContent = friendlyError(err); pe.hidden = false; btn.disabled = false; btn.innerHTML = `${ICON.plus}Crea utente`; }
    };
  });
}
function credText(name, username, password) {
  return `Ciao ${name.split(' ')[0]}, ecco il tuo accesso all'app di Epicuro:\n${location.origin}\nNome utente: ${username}\nPassword: ${password}`;
}
function credSheet(name, username, password, isNew) {
  const txt = credText(name, username, password);
  openSheet(`<h3>${isNew ? 'Utente creato' : 'Password aggiornata'}</h3><p class="sub">Invia queste credenziali a ${esc(name)}, per esempio su WhatsApp.</p>
  <div class="cred">${esc(txt)}</div>
  <div class="sheet-actions"><button class="btn" data-act="users">Torna agli utenti</button><button class="btn primary" id="c-copy">${ICON.copy}Copia messaggio</button></div>`, (el) => {
    el.querySelector('#c-copy').onclick = (e) => copyText(txt, e.currentTarget);
  });
}
function passwordSheet(u) {
  openSheet(`<h3>Nuova password</h3><p class="sub">Per ${esc(u.name)} (${esc(u.username)}). La vecchia smette di funzionare subito.</p>
  <form class="form" id="pf">${pwdField('p-pass', 'Nuova password', { autocomplete: 'new-password', value: genPassword() })}
  <p class="err" id="p-err" hidden></p>
  <div class="sheet-actions"><button type="button" class="btn" data-act="users">Indietro</button><button class="btn primary" type="submit">Salva password</button></div></form>`, (el) => {
    el.querySelector('#pf').onsubmit = async (e) => {
      e.preventDefault(); const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
      const pw = el.querySelector('#p-pass').value;
      try { await call('setStaffPassword', { uid: u.id, password: pw }); credSheet(u.name, u.username, pw, false); }
      catch (err) { const pe = el.querySelector('#p-err'); pe.textContent = friendlyError(err); pe.hidden = false; btn.disabled = false; }
    };
  });
}

/* ---------- account ---------- */
function accountSheet() {
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const pushOn = perm === 'granted' && !!lsGet('epicuro-token');
  let pushRow;
  if (isIOS() && !isStandalone()) pushRow = 'Su iPhone installa prima l\'app: in Safari tocca Condividi → Aggiungi alla schermata Home.';
  else if (perm === 'unsupported') pushRow = 'Questo browser non supporta le notifiche.';
  else if (perm === 'denied') pushRow = 'Bloccate: riattivale dalle impostazioni del telefono.';
  else pushRow = pushOn ? 'Attive su questo telefono.' : '';
  openSheet(`<h3>${esc(S.me.name)}</h3><p class="sub">${esc(S.me.username || '')} · ${S.isAdmin ? 'Amministratore' : 'Staff'}</p>
  <div class="card pad" style="box-shadow:none"><div style="display:flex;align-items:center;gap:12px">${ICON.bell.replace('<svg', '<svg style="width:22px;height:22px;flex:none"')}
    <div class="grow" style="flex:1"><b>Notifiche dei turni</b><div class="muted" style="font-size:14px">${esc(pushRow) || 'Non ancora attive su questo telefono.'}</div></div>
    ${!pushOn && perm === 'default' && !(isIOS() && !isStandalone()) ? '<button class="btn sm primary" data-act="push">Attiva</button>' : ''}
    ${pushOn ? '<button class="btn sm" data-act="push-test">Prova</button>' : ''}</div></div>
  ${S.installEvt ? '<button class="btn block" data-act="install" style="margin-top:10px">Installa l\'app sul telefono</button>' : ''}
  <button class="btn block" data-act="qr" style="margin-top:10px">${ICON.qr}Fai scaricare l'app a un collega</button>
  <form class="form" id="mf" style="margin-top:16px">
    <div class="eyebrow">Cambia la tua password</div>
    ${pwdField('m-old', 'Password attuale', { autocomplete: 'current-password' })}
    ${pwdField('m-new', 'Nuova password', { autocomplete: 'new-password', hint: 'Almeno 6 caratteri.' })}
    <p class="err" id="m-err" hidden></p>
    <button class="btn block" type="submit">Cambia password</button>
  </form>
  <div class="sheet-actions" style="margin-top:14px"><button class="btn" data-close>Chiudi</button><button class="btn danger" id="logout">Esci</button></div>`, (el) => {
    el.querySelector('#logout').onclick = async () => { closeSheet(); await forgetToken(); await signOut(auth); };
    el.querySelector('#mf').onsubmit = async (e) => {
      e.preventDefault(); const pe = el.querySelector('#m-err'); pe.hidden = true;
      try {
        const u = auth.currentUser;
        await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, el.querySelector('#m-old').value));
        await updatePassword(u, el.querySelector('#m-new').value);
        toast('Password cambiata'); closeSheet();
      } catch (err) { pe.textContent = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' ? 'La password attuale non è corretta.' : friendlyError(err); pe.hidden = false; }
    };
  });
}

/* ---------- QR per scaricare l'app ---------- */
/* Il QR contiene sempre l'indirizzo da cui l'app è aperta: resta giusto anche se il dominio cambia. */
const APP_URL = () => location.origin + '/';
function loadQrLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  return new Promise((res, rej) => {
    const sc = document.createElement('script'); sc.src = '/vendor/qrcode.js';
    sc.onload = () => res(window.qrcode); sc.onerror = () => rej(new Error('qr')); document.head.appendChild(sc);
  });
}
async function drawQr(canvas, text, size) {
  const qrcode = await loadQrLib();
  await document.fonts.load('700 40px Cinzel').catch(() => {});
  const qr = qrcode(0, 'H'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), quiet = 4, cell = Math.max(2, Math.floor(size / (n + quiet * 2))), px = cell * (n + quiet * 2);
  canvas.width = px; canvas.height = px;
  const c = canvas.getContext('2d');
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, px, px);
  c.fillStyle = '#B3121C';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) c.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
  // Al centro la E di Epicuro (la correzione d'errore "H" permette di coprire questa parte).
  const box = Math.round(n * cell * 0.22), x = (px - box) / 2, rad = box * 0.18;
  c.fillStyle = '#FFFFFF'; c.beginPath(); c.roundRect(x - cell, x - cell, box + 2 * cell, box + 2 * cell, rad + cell); c.fill();
  c.strokeStyle = '#B3121C'; c.lineWidth = Math.max(2, cell * 0.6); c.beginPath(); c.roundRect(x, x, box, box, rad); c.stroke();
  c.fillStyle = '#B3121C'; c.font = `700 ${Math.round(box * 0.66)}px Cinzel, "Times New Roman", serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('E', px / 2, px / 2 + box * 0.05);
  return canvas;
}
const QR_STEPS = `<ol class="steps">
  <li>Inquadra il codice con la <b>fotocamera</b> del telefono e apri il link.</li>
  <li><b>iPhone:</b> in Safari tocca <b>Condividi</b> → <b>Aggiungi alla schermata Home</b>.<br><b>Android:</b> in Chrome tocca il menu ⋮ → <b>Installa app</b>.</li>
  <li>Apri Epicuro dall'icona, entra con nome utente e password e attiva le notifiche.</li></ol>`;
function qrSheet() {
  const url = APP_URL();
  openSheet(`<h3>Scarica l'app</h3><p class="sub">Fai inquadrare questo codice a chi deve installare l'app.</p>
  <canvas id="qr-c" class="qr" width="300" height="300" aria-label="QR code con il link all'app"></canvas>
  <p class="qr-url num">${esc(url.replace(/\/$/, ''))}</p>
  ${QR_STEPS}
  <p class="hint muted" style="margin:0;font-size:13px">Il codice apre solo l'app: per entrare servono nome utente e password, che crea l'amministratore.</p>
  <div class="sheet-actions"><button class="btn" id="qr-copy">${ICON.copy}Copia link</button><button class="btn primary" id="qr-print">Stampa locandina</button></div>
  <button class="btn ghost block" data-close style="margin-top:8px">Chiudi</button>`, (el) => {
    drawQr(el.querySelector('#qr-c'), url, 600).catch(() => { el.querySelector('#qr-c').replaceWith(Object.assign(document.createElement('p'), { className: 'notice', textContent: 'Non è stato possibile disegnare il QR. Usa "Copia link".' })); });
    el.querySelector('#qr-copy').onclick = (e) => copyText(url, e.currentTarget);
    el.querySelector('#qr-print').onclick = () => printPoster(url);
  });
}
async function printPoster(url) {
  const pst = $('#poster');
  pst.innerHTML = `<div class="poster-in"><span class="mark mark-e mark-lg" aria-hidden="true">E</span>
    <h1>Epicuro Staff</h1><p class="tag">Birreria · Vineria · Cucina</p>
    <img id="poster-qr" alt="QR code per scaricare l'app">
    <p class="qr-url">${esc(url.replace(/\/$/, ''))}</p>${QR_STEPS}</div>`;
  try { pst.querySelector('#poster-qr').src = (await drawQr(document.createElement('canvas'), url, 1000)).toDataURL('image/png'); } catch (e) { toast('QR non disponibile'); return; }
  pst.hidden = false;
  const done = () => { pst.hidden = true; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 150);
}

/* ---------- notifiche ---------- */
async function pushReady() {
  if (!CONFIGURED || !('serviceWorker' in navigator) || !('Notification' in window)) return null;
  if (!(await messagingSupported().catch(() => false))) return null;
  if (!messaging) {
    messaging = getMessaging(app);
    onMessage(messaging, (p) => { const n = p.notification || {}; toast(`${n.title || 'Epicuro'} — ${n.body || ''}`); });
  }
  return navigator.serviceWorker.register('/firebase-messaging-sw.js');
}
async function saveToken() {
  const reg = await pushReady(); if (!reg) throw new Error('unsupported');
  const token = await getToken(messaging, { vapidKey: CFG.vapidKey, serviceWorkerRegistration: reg });
  if (!token) throw new Error('no-token');
  const old = lsGet('epicuro-token');
  if (old && old !== token) await deleteDoc(doc(db, 'users', S.uid, 'tokens', old.slice(-140))).catch(() => {});
  await setDoc(doc(db, 'users', S.uid, 'tokens', token.slice(-140)), { token, ua: navigator.userAgent.slice(0, 160), updatedAt: serverTimestamp() });
  lsSet('epicuro-token', token); lsSet('epicuro-token-uid', S.uid);
}
async function enablePush() {
  if (isIOS() && !isStandalone()) { toast('Su iPhone installa prima l\'app dalla schermata Home'); return; }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Notifiche non consentite'); render(); return; }
    await saveToken(); toast('Notifiche attive'); render(); if (!$('#sheet').hidden) accountSheet();
  } catch (e) { console.warn(e); toast('Non è stato possibile attivare le notifiche su questo telefono.'); }
}
/* All'avvio rinnova in silenzio il token se le notifiche sono già consentite. */
async function refreshPush() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (lsGet('epicuro-token-uid') && lsGet('epicuro-token-uid') !== S.uid) lsSet('epicuro-token', null);
  try { await saveToken(); } catch (e) { /* niente */ }
}
async function forgetToken() {
  const t = lsGet('epicuro-token');
  if (t && S.uid) await deleteDoc(doc(db, 'users', S.uid, 'tokens', t.slice(-140))).catch(() => {});
  lsSet('epicuro-token', null); lsSet('epicuro-token-uid', null);
}
async function testPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('Epicuro', { body: 'Le notifiche funzionano su questo telefono.', icon: '/icons/icon-192.png', badge: '/icons/badge-96.png' });
  } catch (e) { toast('Notifica di prova non riuscita'); }
}

/* ---------- meteo: solo Varese (CAP 21100), coordinate fisse del centro città ---------- */
const VARESE = { lat: 45.8206, lon: 8.8251, label: 'Varese 21100' };
const WX = [
  [[0], 'Sereno', 'sun'], [[1], 'Poco nuvoloso', 'sun'], [[2], 'Parzialmente nuvoloso', 'cloudsun'], [[3], 'Nuvoloso', 'cloud'],
  [[45, 48], 'Nebbia', 'fog'], [[51, 53, 55, 56, 57], 'Pioviggine', 'rain'], [[61, 63, 65, 66, 67], 'Pioggia', 'rain'],
  [[71, 73, 75, 77], 'Neve', 'snow'], [[80, 81, 82], 'Rovesci', 'rain'], [[85, 86], 'Rovesci di neve', 'snow'], [[95, 96, 99], 'Temporale', 'storm']];
const WX_ICON = {
  sun: '<circle cx="24" cy="24" r="8"/><path d="M24 6v5M24 37v5M6 24h5M37 24h5M11.3 11.3l3.5 3.5M33.2 33.2l3.5 3.5M11.3 36.7l3.5-3.5M33.2 14.8l3.5-3.5"/>',
  cloudsun: '<circle cx="18" cy="17" r="6"/><path d="M18 5v3M6 17h3M9.5 8.5l2 2M26.5 8.5l-2 2"/><path d="M15 38h20a7 7 0 0 0 0-14 10 10 0 0 0-19 3 5.5 5.5 0 0 0-1 11Z"/>',
  cloud: '<path d="M13 37h22a8 8 0 0 0 0-16 11 11 0 0 0-21 3.5A6.3 6.3 0 0 0 13 37Z"/>',
  fog: '<path d="M8 18h32M6 25h36M10 32h28M14 39h20"/>',
  rain: '<path d="M13 30h22a8 8 0 0 0 0-16 11 11 0 0 0-21 3.5A6.3 6.3 0 0 0 13 30Z"/><path d="M17 35l-2 5M25 35l-2 5M33 35l-2 5"/>',
  snow: '<path d="M13 28h22a8 8 0 0 0 0-16 11 11 0 0 0-21 3.5A6.3 6.3 0 0 0 13 28Z"/><path d="M17 35h.01M24 38h.01M31 35h.01M20 42h.01M28 42h.01"/>',
  storm: '<path d="M13 28h22a8 8 0 0 0 0-16 11 11 0 0 0-21 3.5A6.3 6.3 0 0 0 13 28Z"/><path d="M25 31l-4 6h6l-4 6"/>',
};
async function loadWeather() {
  try {
    const c = JSON.parse(lsGet('epicuro-wx') || 'null');
    if (c && Date.now() - c.t < 30 * 60e3) { S.weather = c.w; render(); return; }
  } catch (e) { /* */ }
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${VARESE.lat}&longitude=${VARESE.lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FRome&forecast_days=1`;
    const r = await fetch(u); if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    S.weather = { temp: j.current.temperature_2m, code: j.current.weather_code, max: j.daily.temperature_2m_max[0], min: j.daily.temperature_2m_min[0], rain: j.daily.precipitation_probability_max[0] };
    lsSet('epicuro-wx', JSON.stringify({ t: Date.now(), w: S.weather }));
  } catch (e) { S.weather = { error: true }; }
  render();
}
function weatherCard() {
  const w = S.weather;
  if (!w) return '<div class="card weather ghost"><div class="d">Carico il meteo di Varese 21100…</div></div>';
  if (w.error) return '<div class="card weather ghost"><div class="d">Meteo di Varese 21100 non disponibile in questo momento.</div></div>';
  const m = WX.find((x) => x[0].includes(w.code)) || [[], 'Variabile', 'cloud'];
  return `<div class="card weather"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WX_ICON[m[2]]}</svg>
    <span class="t">${Math.round(w.temp)}°</span>
    <div class="d"><b>${m[1]} · ${VARESE.label}</b><span class="num">Max ${Math.round(w.max)}° · min ${Math.round(w.min)}°${w.rain != null ? ` · pioggia ${w.rain}%` : ''}</span></div></div>`;
}

/* ---------- prenotazioni ---------- */
function resRow(r) {
  const u = userById(r.by);
  return `<div class="res" role="button" tabindex="0" data-act="edit-res" data-id="${esc(r.id)}">
    <span class="time">${esc(r.time)}</span>
    <span class="who">${esc(r.name)}<small>${r.phone ? `<a class="tel" href="tel:${esc(r.phone.replace(/[^+0-9]/g, ''))}">${esc(r.phone)}</a>` : 'nessun telefono'}${r.note ? ' · ' + esc(r.note) : ''}</small></span>
    <span class="ppl"><b>${Number(r.people) || 0}</b><small>${Number(r.people) === 1 ? 'persona' : 'persone'}</small></span></div>`;
}
function renderPren() {
  const days = Array.from({ length: 14 }, (_, i) => addDays(S.stripStart, i));
  const today = ymd(serviceDate());
  const byDay = {}; S.resRange.forEach((r) => { (byDay[r.date] = byDay[r.date] || []).push(r); });
  const list = (byDay[S.resDay] || []).sort((a, b) => smin(a.time) - smin(b.time));
  const covers = list.reduce((n, r) => n + (Number(r.people) || 0), 0);
  const sel = parseYmd(S.resDay);
  $('#v-pren').innerHTML = `${offlineNote()}
  <div class="sec-h"><h2>Prenotazioni</h2><label class="eyebrow" style="display:flex;align-items:center;gap:6px">Vai al <input id="res-date" type="date" value="${S.resDay}" style="border:1px solid var(--line);border-radius:8px;padding:4px 6px;background:var(--surface);font-size:14px"></label></div>
  <div class="weekbar">
    <button class="icon-btn" data-act="res-strip" data-d="-7" aria-label="Settimana precedente">${ICON.left}</button>
    <div class="daystrip" style="flex:1;min-width:0">${days.map((d) => { const k = ymd(d); const n = (byDay[k] || []).reduce((a, r) => a + (Number(r.people) || 0), 0); return `
      <button class="daybtn${k === today ? ' today' : ''}" data-act="res-day" data-date="${k}" aria-pressed="${k === S.resDay}"><small>${DAYS_S[(d.getDay() + 6) % 7]}</small><b>${d.getDate()}</b><span class="c">${n ? n + ' p.' : ''}</span></button>`; }).join('')}</div>
    <button class="icon-btn" data-act="res-strip" data-d="7" aria-label="Settimana successiva">${ICON.right}</button>
  </div>
  <div class="card">
    <div class="pad" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--line)">
      <div style="flex:1;min-width:0"><b style="font-family:var(--f-display);font-size:18px;text-transform:capitalize">${esc(sel.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }))}</b>
      <div class="totals"><span><b>${list.length}</b> ${list.length === 1 ? 'prenotazione' : 'prenotazioni'}</span><span><b>${covers}</b> persone</span></div></div>
      <button class="btn sm ale" data-act="new-res" data-date="${S.resDay}">${ICON.plus}Nuova</button></div>
    ${!S.loaded.res ? '<div class="empty-day">Caricamento…</div>' : list.length ? list.map(resRow).join('') : '<div class="empty-day">Nessuna prenotazione per questo giorno.</div>'}
  </div>
  ${S.resDay !== today ? '<button class="btn sm ghost" data-act="res-strip" data-d="0" style="align-self:center">Torna a oggi</button>' : ''}`;
  const strip = $('#v-pren .daystrip'); const on = strip && strip.querySelector('[aria-pressed="true"]');
  if (on && renderPren.lastDay !== S.resDay) { on.scrollIntoView({ block: 'nearest', inline: 'center' }); renderPren.lastDay = S.resDay; }
}
function resSheet(r, date) {
  const isNew = !r;
  r = r || { date: date || ymd(serviceDate()), time: '20:00', name: '', phone: '', people: 2, note: '' };
  let ppl = Number(r.people) || 2;
  const u = !isNew ? userById(r.by) : null;
  openSheet(`<h3>${isNew ? 'Nuova prenotazione' : 'Prenotazione'}</h3><p class="sub">${isNew ? 'Tutti i campi tranne la nota sono obbligatori.' : `Inserita da ${esc(u ? u.name : 'staff')}`}</p>
  <form class="form" id="rf">
    <div class="two"><div class="field"><label for="r-date">Giorno</label><input id="r-date" type="date" required value="${esc(r.date)}"></div>
    <div class="field"><label for="r-time">Orario</label><select id="r-time">${timeOpts(r.time, RES_TIMES)}</select></div></div>
    <div class="field"><label for="r-name">Nome di chi prenota</label><input id="r-name" required maxlength="60" value="${esc(r.name)}" autocomplete="off" ${isNew ? 'autofocus' : ''}></div>
    <div class="field"><label for="r-phone">Telefono</label><input id="r-phone" type="tel" inputmode="tel" required maxlength="30" value="${esc(r.phone)}" placeholder="es. 333 123 4567" autocomplete="off"></div>
    <div class="field"><label>Numero di persone</label>
      <div class="stepper" style="margin:0"><button type="button" id="r-minus" aria-label="Meno">−</button><output id="r-ppl" class="num">${ppl}</output><button type="button" id="r-plus" aria-label="Più">+</button></div></div>
    <div class="field"><label for="r-note">Nota (facoltativa)</label><input id="r-note" maxlength="300" value="${esc(r.note || '')}" placeholder="es. tavolo fuori, compleanno, seggiolone"></div>
    <p class="err" id="r-err" hidden></p>
    <div class="sheet-actions"><button type="button" class="btn" data-close>Annulla</button><button class="btn primary" type="submit">Salva</button></div>
    ${isNew ? '' : '<button type="button" class="btn danger block" id="r-del">Cancella prenotazione</button>'}
  </form>`, (el) => {
    const out = el.querySelector('#r-ppl');
    const upd = () => { out.textContent = ppl; el.querySelector('#r-minus').disabled = ppl <= 1; el.querySelector('#r-plus').disabled = ppl >= 200; }; upd();
    el.querySelector('#r-minus').onclick = () => { ppl = Math.max(1, ppl - 1); upd(); };
    el.querySelector('#r-plus').onclick = () => { ppl = Math.min(200, ppl + 1); upd(); };
    el.querySelector('#rf').onsubmit = (e) => {
      e.preventDefault();
      const pe = el.querySelector('#r-err');
      const data = { date: el.querySelector('#r-date').value, time: el.querySelector('#r-time').value, name: el.querySelector('#r-name').value.trim(),
        phone: el.querySelector('#r-phone').value.trim(), people: ppl, note: el.querySelector('#r-note').value.trim() };
      let er = '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) er = 'Scegli il giorno.';
      else if (!data.name) er = 'Scrivi il nome di chi prenota.';
      else if (!/^[+0-9][0-9 ./()-]{5,28}$/.test(data.phone)) er = 'Scrivi un numero di telefono valido.';
      if (er) { pe.textContent = er; pe.hidden = false; return; }
      const job = isNew
        ? () => setDoc(doc(collection(db, 'reservations')), { ...data, by: S.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        : () => updateDoc(doc(db, 'reservations', r.id), { ...data, updatedAt: serverTimestamp() });
      write(job, isNew ? `Prenotazione salvata: ${data.name}, ${data.people} ${data.people === 1 ? 'persona' : 'persone'}` : 'Prenotazione aggiornata').catch(() => {});
      if (data.date !== S.resDay && S.view === 'pren') { S.resDay = data.date; const d0 = parseYmd(data.date); if (d0 < S.stripStart || d0 > addDays(S.stripStart, 13)) { S.stripStart = mondayOf(d0); restartStrip(); } }
      closeSheet(); render();
    };
    const del = el.querySelector('#r-del');
    if (del) del.onclick = () => armButton(del, 'Tocca di nuovo per cancellare', () => { write(() => deleteDoc(doc(db, 'reservations', r.id)), 'Prenotazione cancellata').catch(() => {}); closeSheet(); });
  });
}

/* ---------- indisponibilità ---------- */
const isUnavail = (uid, k) => (S.unavail[uid] || []).includes(k);
function unavLine(k) {
  if (!S.isAdmin) return isUnavail(S.uid, k) ? '<div class="unav">Hai segnato questo giorno come non disponibile</div>' : '';
  const who = S.staff.filter((u) => isUnavail(u.id, k)).map((u) => u.name);
  return who.length ? `<div class="unav">Non disponibili: ${esc(who.join(', '))}</div>` : '';
}
function unavailSheet() {
  const today = ymd(serviceDate());
  const sel = new Set((S.unavail[S.uid] || []).filter((k) => k >= today));
  let month = new Date(serviceDate().getFullYear(), serviceDate().getMonth(), 1);
  const draw = (el) => {
    const first = (month.getDay() + 6) % 7; const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    let cells = DAYS_S.map((d) => `<span class="h">${d}</span>`).join('') + '<span></span>'.repeat(first);
    for (let i = 1; i <= n; i++) {
      const k = ymd(new Date(month.getFullYear(), month.getMonth(), i));
      cells += `<button type="button" data-k="${k}" aria-pressed="${sel.has(k)}" class="${k === today ? 'today' : ''}" ${k < today ? 'disabled' : ''} aria-label="${i} ${MONTHS[month.getMonth()]}">${i}</button>`;
    }
    el.querySelector('#cal-m').textContent = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;
    el.querySelector('#cal').innerHTML = cells;
    el.querySelector('#cal-prev').disabled = month <= new Date(serviceDate().getFullYear(), serviceDate().getMonth(), 1);
    el.querySelector('#cal-n').textContent = sel.size ? `${sel.size} ${sel.size === 1 ? 'giorno segnato' : 'giorni segnati'}` : 'Nessun giorno segnato';
  };
  openSheet(`<h3>Giorni in cui non ci sei</h3><p class="sub">Tocca i giorni in cui non puoi lavorare. L'amministratore li vede quando prepara i turni.</p>
  <div class="cal-h"><button type="button" class="icon-btn" id="cal-prev" aria-label="Mese precedente">${ICON.left}</button><b id="cal-m"></b><button type="button" class="icon-btn" id="cal-next" aria-label="Mese successivo">${ICON.right}</button></div>
  <div class="cal" id="cal"></div>
  <p class="hint muted" id="cal-n" style="margin:10px 0 0;font-size:14px"></p>
  <div class="sheet-actions"><button class="btn" data-close>Annulla</button><button class="btn primary" id="cal-save">Salva</button></div>`, (el) => {
    draw(el);
    el.querySelector('#cal-prev').onclick = () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); draw(el); };
    el.querySelector('#cal-next').onclick = () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); draw(el); };
    el.querySelector('#cal').onclick = (e) => { const b = e.target.closest('button[data-k]'); if (!b || b.disabled) return; const k = b.dataset.k; sel.has(k) ? sel.delete(k) : sel.add(k); b.setAttribute('aria-pressed', sel.has(k)); draw(el); };
    el.querySelector('#cal-save').onclick = () => {
      const dates = [...sel].sort();
      S.unavail = { ...S.unavail, [S.uid]: dates };
      write(() => setDoc(doc(db, 'unavail', S.uid), { dates, updatedAt: serverTimestamp() }), 'Disponibilità salvata').catch(() => {});
      closeSheet(); render();
    };
  });
}

/* ---------- eventi ---------- */
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) { closeSheet(); return; }
  if (e.target.closest('a[href^="tel:"]')) return;
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  const H = {
    tfilter: () => { S.type = b.dataset.k; render(); },
    sfilter: () => { S.staffFilter = b.dataset.id; render(); },
    week: () => { const d = +b.dataset.d; setWeek(d === 0 ? serviceDate() : addDays(S.week, d)); },
    sell: () => { const w = S.wines.find((x) => x.id === b.dataset.id); if (w) sellSheet(w); },
    'edit-wine': () => { const w = S.wines.find((x) => x.id === b.dataset.id); if (w) wineSheet(w); },
    'new-wine': () => wineSheet(null),
    import: () => importSheet(),
    'new-shift': () => shiftSheet(null, +b.dataset.day),
    'edit-shift': () => { const x = editItems().find((y) => y.id === b.dataset.id); if (x) shiftSheet(x); },
    'copy-week': () => copyWeek(b),
    'clear-week': () => clearWeek(b),
    publish: () => publishSheet(),
    unpublish: () => unpublish(b),
    users: () => usersSheet(),
    unavail: () => unavailSheet(),
    'new-res': () => resSheet(null, b.dataset.date || S.resDay),
    'edit-res': () => { const r = [...S.resRange, ...S.resToday].find((x) => x.id === b.dataset.id); if (r) resSheet(r); },
    'res-day': () => { S.resDay = b.dataset.date; render(); },
    'res-strip': () => { const d = +b.dataset.d; S.stripStart = d === 0 ? serviceDate() : addDays(S.stripStart, d); S.resDay = ymd(d === 0 ? serviceDate() : S.stripStart); restartStrip(); render(); },
    account: () => accountSheet(),
    push: () => enablePush(),
    'push-test': () => testPush(),
    qr: () => qrSheet(),
    'hide-push': () => { lsSet('epicuro-hide-push', '1'); render(); },
    install: async () => { const ev = S.installEvt; S.installEvt = null; closeSheet(); if (ev) { ev.prompt(); await ev.userChoice.catch(() => {}); } },
    'undo-sale': () => armButton(b, 'Conferma', () => { const s = S.sales.find((x) => x.id === b.dataset.id); if (s) undoSale(s); }),
  };
  if (H[act]) H[act]();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.res[data-act]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('change', (e) => { if (e.target.id === 'res-date' && e.target.value) { S.resDay = e.target.value; S.stripStart = mondayOf(parseYmd(e.target.value)); restartStrip(); render(); } });
function route() {
  const h = (location.hash || '').slice(1);
  S.view = ['oggi', 'pren', 'turni', 'cantina'].includes(h) ? h : 'oggi';
  render(); window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
window.addEventListener('online', () => { S.online = true; render(); });
window.addEventListener('offline', () => { S.online = false; render(); });
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; });
/* La giornata del locale cambia alle 06:00: aggiorna le viste ogni minuto (non mentre si scrive). */
setInterval(() => {
  const ae = document.activeElement;
  if (!S.me || document.hidden || !$('#sheet').hidden || (ae && /INPUT|SELECT|TEXTAREA/.test(ae.tagName))) return;
  watchCurrent(); render();
}, 60e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.me) { watchCurrent(); render(); } });

/* ---------- avvio ---------- */
if (!CONFIGURED) renderNotConfigured();
else {
  onAuthStateChanged(auth, onAuth);
  if ('serviceWorker' in navigator && !LOCAL) navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => {});
}
// Per le prove automatiche.
if (LOCAL) window.__epicuro = { S, render };
