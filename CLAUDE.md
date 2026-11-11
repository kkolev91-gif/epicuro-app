# Epicuro Staff

App per il telefono (PWA) dello staff di **Epicuro**, birreria e vineria con cucina in Via Carlo Cattaneo 12, Varese.
Chi chiede modifiche è il titolare: scrive in italiano e non è un programmatore. Rispondi in italiano, in modo semplice.

## Struttura
- `public/` — l'app (HTML/CSS/JS senza build). `index.html` (stile e struttura), `app.js` (tutta la logica, modulo ES con Firebase SDK 10.12.2 da gstatic), `config.js` (configurazione Firebase pubblica, letta anche dal service worker), `firebase-messaging-sw.js` (notifiche push + copia offline), `manifest.webmanifest`, `icons/`.
- `functions/index.js` — Cloud Functions (regione `europe-west1`): `createStaff`, `setStaffPassword`, `removeStaff` (solo admin) e `notifyOnPublish` (notifica personalizzata a ogni dipendente quando l'admin pubblica i turni).
- `firestore.rules` — permessi. Va aggiornato insieme a ogni nuova collezione o campo.
- `.github/workflows/deploy.yml` — ogni push su `main` pubblica su Firebase (hosting, regole, funzioni).
- `tests/run.sh` + `tests/e2e.js` — test completi su emulatori Firebase con tre utenti (Marco admin, Giulia e Luca staff).
- `GUIDA.md` — guida per il titolare (configurazione iniziale e uso).

## Dati (Firestore)
- `users/{uid}`: name, username, role (`admin`|`staff`), active, color. Sotto: `tokens/{id}` per le notifiche.
- `drafts/{settimana}` (solo admin) e `shifts/{settimana}` (pubblicati): `{items:[{id, day 0-6, staffId, start, end, area, note}]}`; la chiave settimana è il lunedì `YYYY-MM-DD`.
- `reservations/{id}`: date, time, name, phone, people, note, by.
- `unavail/{uid}`: dates[] (giorni di indisponibilità).
- `wines/{id}`: name, producer, type, region, stock, sold, minStock, stockSetAt. Disponibili = stock − sold.
- `sales/{id}`: wineId, wineName, qty, ver (= stockSetAt al momento della vendita), by, at (ora del server).
- `config/setup`: creato al primo avvio (il primo account diventa admin).

## Regole del locale
- Turni dalle 10:00 alle 02:00. La "giornata di servizio" cambia alle 06:00 (dopo mezzanotte è ancora la serata precedente).
- Login con nome utente: internamente diventa `nomeutente@staff.epicuro.app`.
- Meteo: solo Varese (CAP 21100), coordinate fisse 45.8206, 8.8251, servizio Open-Meteo (senza chiave).
- Grafica: rosso `#B3121C` e bianco, un solo tema chiaro. Marchio: "E" rossa in Cinzel (capitale romana). Testi in italiano.

## Come lavorare
- Dopo ogni modifica lancia i test: `bash tests/run.sh` (servono Java, Node 20 e Playwright). Aggiungi un test per ogni nuova funzione. L'unico "400" nei log è il test della password sbagliata.
- Se cambi file in `public/`, aumenta `CACHE` in `firebase-messaging-sw.js` così i telefoni scaricano la nuova versione.
- Push su `main` = l'app online si aggiorna in pochi minuti per tutto lo staff. Pubblica solo modifiche testate.
- Mai salvare chiavi private nel repository: la chiave dell'account di servizio sta solo nel segreto GitHub `FIREBASE_SERVICE_ACCOUNT`.
