/* Epicuro Staff — funzioni lato server.
 * - createStaff / setStaffPassword / removeStaff: gestione utenti, solo per l'amministratore.
 * - notifyOnPublish: quando l'amministratore pubblica i turni, invia una notifica a ogni telefono
 *   dello staff con i propri turni della settimana.
 */
const { setGlobalOptions } = require('firebase-functions/v2');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 5 });

const db = admin.firestore();
const EMAIL_DOMAIN = 'staff.epicuro.app';
const COLORS = 10;
const IN_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

const emailOf = (username) => `${username}@${EMAIL_DOMAIN}`;
const cleanUsername = (u) => String(u || '').trim().toLowerCase();

async function requireAdmin(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Accedi di nuovo.');
  const me = await db.doc(`users/${req.auth.uid}`).get();
  if (!me.exists || me.get('active') !== true || me.get('role') !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo l\'amministratore può gestire gli utenti.');
  }
  return me;
}
function checkPassword(p) {
  if (typeof p !== 'string' || p.length < 6) throw new HttpsError('invalid-argument', 'La password deve avere almeno 6 caratteri.');
  if (p.length > 64) throw new HttpsError('invalid-argument', 'La password è troppo lunga (massimo 64 caratteri).');
}

exports.createStaff = onCall(async (req) => {
  await requireAdmin(req);
  const name = String(req.data?.name || '').trim().slice(0, 40);
  const username = cleanUsername(req.data?.username);
  const role = req.data?.role === 'admin' ? 'admin' : 'staff';
  const password = req.data?.password;
  if (!name) throw new HttpsError('invalid-argument', 'Scrivi il nome della persona.');
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
    throw new HttpsError('invalid-argument', 'Il nome utente deve avere 3–30 caratteri: lettere minuscole, numeri, punto, trattino.');
  }
  checkPassword(password);

  let user;
  try {
    user = await admin.auth().createUser({ email: emailOf(username), password, displayName: name });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') throw new HttpsError('already-exists', `Il nome utente "${username}" è già usato.`);
    throw new HttpsError('internal', 'Non è stato possibile creare l\'utente.');
  }
  try {
    const used = new Set((await db.collection('users').where('active', '==', true).get()).docs.map((d) => d.get('color')));
    let color = 0; while (used.has(color) && color < COLORS) color++;
    await db.doc(`users/${user.uid}`).set({
      name, username, role, active: true, color: color % COLORS,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    // Niente account a metà: se il profilo non si salva, l'accesso creato viene annullato.
    await admin.auth().deleteUser(user.uid).catch(() => {});
    throw new HttpsError('internal', 'Non è stato possibile creare l\'utente. Riprova.');
  }
  return { uid: user.uid, username };
});

exports.setStaffPassword = onCall(async (req) => {
  await requireAdmin(req);
  const uid = String(req.data?.uid || '');
  checkPassword(req.data?.password);
  const u = await db.doc(`users/${uid}`).get();
  if (!u.exists || u.get('active') !== true) throw new HttpsError('not-found', 'Utente non trovato.');
  await admin.auth().updateUser(uid, { password: req.data.password });
  await admin.auth().revokeRefreshTokens(uid);
  return { ok: true };
});

exports.removeStaff = onCall(async (req) => {
  await requireAdmin(req);
  const uid = String(req.data?.uid || '');
  if (uid === req.auth.uid) throw new HttpsError('failed-precondition', 'Non puoi rimuovere il tuo stesso account.');
  const ref = db.doc(`users/${uid}`);
  const u = await ref.get();
  if (!u.exists) throw new HttpsError('not-found', 'Utente non trovato.');
  try { await admin.auth().deleteUser(uid); } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
  // Il documento resta (disattivato) così i nomi nello storico restano leggibili.
  await ref.update({ active: false, removedAt: FieldValue.serverTimestamp() });
  const toks = await ref.collection('tokens').get();
  await Promise.all(toks.docs.map((d) => d.ref.delete()));
  return { ok: true };
});

/* ---------- notifiche ---------- */
const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const smin = (t) => { const [h, m] = String(t).split(':').map(Number); const v = h * 60 + (m || 0); return v < 360 ? v + 1440 : v; };

function weekLabel(weekKey) {
  const [y, m, d] = weekKey.split('-').map(Number);
  const a = new Date(Date.UTC(y, m - 1, d)); const b = new Date(Date.UTC(y, m - 1, d + 6));
  return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
}
function bodyFor(uid, items) {
  const mine = items.filter((x) => x.staffId === uid).sort((a, b) => a.day - b.day || smin(a.start) - smin(b.start));
  if (!mine.length) return 'Questa settimana non hai turni.';
  const list = mine.map((x) => `${DAYS[x.day]} ${x.start}–${x.end}`).join(', ');
  return `${mine.length === 1 ? 'Il tuo turno' : `I tuoi ${mine.length} turni`}: ${list}`;
}

exports.notifyOnPublish = onDocumentWritten('shifts/{week}', async (event) => {
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  if (!after || after.notify !== true) return;
  const pa = after.publishedAt?.toMillis?.() ?? 0;
  const pb = before?.publishedAt?.toMillis?.() ?? -1;
  if (pa === pb) return; // nessuna nuova pubblicazione

  const week = event.params.week;
  const items = Array.isArray(after.items) ? after.items : [];
  const users = await db.collection('users').where('active', '==', true).get();
  const messages = []; const tokenRefs = [];
  for (const u of users.docs) {
    if (u.id === after.publishedBy) continue; // chi pubblica non riceve la notifica
    const toks = await u.ref.collection('tokens').get();
    for (const t of toks.docs) {
      const token = t.get('token');
      if (!token) continue;
      tokenRefs.push(t.ref);
      messages.push({
        token,
        notification: { title: `Turni pubblicati · ${weekLabel(week)}`, body: bodyFor(u.id, items) },
        webpush: {
          notification: { icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag: `turni-${week}`, renotify: true },
          fcmOptions: { link: `/?settimana=${week}#turni` },
        },
        data: { week },
      });
    }
  }
  if (!messages.length) return;
  if (IN_EMULATOR) {
    // Nell'emulatore non si inviano notifiche vere: si registrano nel database per le prove.
    await db.collection('_testNotifications').add({ week, messages, at: FieldValue.serverTimestamp() });
    return;
  }
  const res = await admin.messaging().sendEach(messages);
  // Toglie i token dei telefoni che non esistono più.
  await Promise.all(res.responses.map((r, i) => {
    const c = r.error?.code;
    if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token' || c === 'messaging/invalid-argument') {
      return tokenRefs[i].delete();
    }
    return null;
  }));
});
