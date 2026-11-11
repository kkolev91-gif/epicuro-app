/* Dati d'esempio per la demo (solo emulatori). Tutti gli utenti hanno password "prova123". */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
// Usa le librerie già installate per le funzioni.
const req = require('module').createRequire(require('path').join(__dirname, '..', 'functions', 'package.json'));
const admin = req('firebase-admin');
const { FieldValue, Timestamp } = req('firebase-admin/firestore');
admin.initializeApp({ projectId: 'demo-epicuro' });
const db = admin.firestore();

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const svc = new Date(Date.now() - 6 * 3600e3); svc.setHours(0, 0, 0, 0);
const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = add(svc, -((svc.getDay() + 6) % 7));
const rid = () => Math.random().toString(36).slice(2, 10);

(async () => {
  const people = [
    ['marco', 'Marco Bianchi', 'admin', 0], ['giulia', 'Giulia Rossi', 'staff', 1],
    ['luca', 'Luca Verdi', 'staff', 2], ['sara', 'Sara Colombo', 'staff', 3], ['andrea', 'Andrea Ferri', 'staff', 4]];
  const uid = {};
  for (const [u, name, role, color] of people) {
    const rec = await admin.auth().createUser({ email: `${u}@staff.epicuro.app`, password: 'prova123', displayName: name });
    uid[u] = rec.uid;
    await db.doc(`users/${rec.uid}`).set({ name, username: u, role, active: true, color, createdAt: FieldValue.serverTimestamp() });
  }
  await db.doc('config/setup').set({ adminUid: uid.marco, at: FieldValue.serverTimestamp() });

  // Turni della settimana (pubblicati) — chiuso il lunedì
  const plan = [
    [1, [['giulia', '18:00', '02:00', 'Sala'], ['andrea', '17:00', '23:30', 'Cucina'], ['luca', '19:00', '01:00', 'Bar e spina']]],
    [2, [['sara', '11:30', '15:00', 'Sala'], ['giulia', '18:00', '02:00', 'Sala'], ['andrea', '17:00', '23:30', 'Cucina']]],
    [3, [['sara', '11:30', '15:00', 'Sala'], ['luca', '18:00', '02:00', 'Bar e spina'], ['andrea', '17:00', '23:30', 'Cucina'], ['marco', '19:00', '01:00', 'Cantina']]],
    [4, [['sara', '18:00', '02:00', 'Sala'], ['giulia', '18:00', '02:00', 'Sala'], ['luca', '18:00', '02:00', 'Bar e spina'], ['andrea', '16:30', '23:30', 'Cucina']]],
    [5, [['sara', '18:00', '02:00', 'Sala'], ['giulia', '18:00', '02:00', 'Sala'], ['luca', '18:00', '02:00', 'Bar e spina'], ['andrea', '16:30', '23:30', 'Cucina'], ['marco', '20:00', '02:00', 'Cantina']]],
    [6, [['giulia', '11:00', '16:00', 'Sala'], ['andrea', '11:00', '15:30', 'Cucina'], ['luca', '18:00', '00:00', 'Bar e spina']]],
  ];
  const items = plan.flatMap(([day, list]) => list.map(([u, start, end, area]) => ({ id: rid(), day, staffId: uid[u], start, end, area, note: '' })));
  items.find((x) => x.day === 4 && x.staffId === uid.sara).note = 'apertura';
  items.find((x) => x.day === 5 && x.staffId === uid.marco).note = 'chiusura cassa';
  const wk = ymd(monday);
  await db.doc(`shifts/${wk}`).set({ items, publishedAt: FieldValue.serverTimestamp(), publishedBy: uid.marco, notify: false });
  await db.doc(`drafts/${wk}`).set({ items, updatedAt: FieldValue.serverTimestamp(), by: uid.marco });
  // Settimana prossima: bozza non ancora pubblicata
  const nk = ymd(add(monday, 7));
  await db.doc(`drafts/${nk}`).set({ items: items.filter((x) => x.day >= 3).map((x) => ({ ...x, id: rid() })), updatedAt: FieldValue.serverTimestamp(), by: uid.marco });

  // Indisponibilità
  await db.doc(`unavail/${uid.luca}`).set({ dates: [ymd(add(monday, 9)), ymd(add(monday, 10))] });
  await db.doc(`unavail/${uid.sara}`).set({ dates: [ymd(add(monday, 12))] });

  // Prenotazioni
  const res = [
    [0, '19:30', 'Famiglia Ferrario', '333 812 4471', 4, 'seggiolone'], [0, '20:00', 'Chiara Bassi', '347 220 1934', 2, ''],
    [0, '20:30', 'Compleanno Davide', '339 551 0087', 10, 'torta portata da loro'], [0, '21:15', 'Martini', '0332 281 554', 3, ''],
    [1, '20:00', 'Gruppo calcetto', '348 990 1212', 8, 'tavolo lungo'], [1, '21:00', 'Elena Rota', '320 445 7781', 2, ''],
    [2, '19:45', 'Bernasconi', '331 700 2290', 5, 'una celiaca'], [3, '20:30', 'Aperitivo aziendale', '0332 245 900', 14, 'fattura'],
  ];
  for (const [d, time, name, phone, ppl, note] of res) {
    await db.collection('reservations').add({ date: ymd(add(svc, d)), time, name, phone, people: ppl, note, by: d % 2 ? uid.giulia : uid.sara, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }

  // Cantina (vini d'esempio)
  const wines = [
    ['Barbera d\'Asti Superiore', 'rosso', 'Piemonte', 14, 3, 1], ['Nebbiolo Langhe', 'rosso', 'Piemonte', 6, 2, 0], ['Valtellina Superiore', 'rosso', 'Lombardia', 4, 3, 1],
    ['Chianti Classico', 'rosso', 'Toscana', 9, 3, 0], ['Primitivo di Manduria', 'rosso', 'Puglia', 2, 3, 0],
    ['Lugana', 'bianco', 'Lombardia', 11, 3, 2], ['Vermentino di Gallura', 'bianco', 'Sardegna', 7, 2, 0], ['Gewürztraminer', 'bianco', 'Alto Adige', 0, 2, 0],
    ['Chiaretto del Garda', 'rose', 'Lombardia', 5, 2, 0], ['Franciacorta Brut', 'bollicine', 'Lombardia', 10, 3, 1], ['Trento DOC Brut', 'bollicine', 'Trentino', 3, 2, 0], ['Prosecco Superiore', 'bollicine', 'Veneto', 18, 4, 2],
  ];
  for (const [name, type, region, stock, minStock, soldToday] of wines) {
    const ver = Date.now() - 86400e3 + Math.random();
    const ref = await db.collection('wines').add({ name, producer: '', type, region, stock: stock + soldToday, sold: soldToday, minStock, stockSetAt: ver, updatedAt: FieldValue.serverTimestamp() });
    for (let i = 0; i < soldToday; i++) {
      await db.collection('sales').add({ wineId: ref.id, wineName: name, wineType: type, qty: 1, ver, by: i ? uid.luca : uid.giulia, at: Timestamp.fromMillis(Math.max(Date.now() - (i + 1) * 47 * 60e3, svc.getTime() + 7 * 3600e3)) });
    }
  }
  console.log('Dati d\'esempio caricati. Utenti: marco (admin), giulia, luca, sara, andrea — password: prova123');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
