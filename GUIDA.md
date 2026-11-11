# Epicuro Staff — come mettere online l'app

App per il telefono dello staff di Epicuro (Varese): Home con benvenuto, meteo di Varese e prenotazioni del giorno; prenotazioni; turni con pubblicazione e notifiche; giorni di indisponibilità; cantina vini.

La prima volta servono circa 30 minuti, tutto dal browser (va bene anche un tablet). Dopo, l'app si usa dal telefono e le modifiche le fa Claude.

---

## 1. Crea il progetto Firebase (gratis, di Google)

1. Vai su <https://console.firebase.google.com> ed entra con un account Google del locale.
2. **Aggiungi progetto** → nome `epicuro-varese` → Google Analytics si può disattivare → **Crea progetto**.

## 2. Attiva il piano "Blaze" (serve per notifiche e utenti)

Le funzioni che creano gli utenti e inviano le notifiche richiedono il piano **Blaze**, a consumo. Va inserita una carta, ma per un locale con 10–20 persone si resta dentro la quota gratuita: **costo previsto 0 €**, al massimo qualche centesimo al mese.

1. In basso a sinistra: **Esegui l'upgrade** → **Blaze**.
2. Imposta un **avviso di budget** di 5 € così ricevi un'email se mai si superasse.

## 3. Accesso con nome utente e password

**Build → Authentication → Inizia → Email/password → Attiva → Salva.**
(L'app usa nomi utente: dietro le quinte li trasforma in indirizzi del tipo `giulia@staff.epicuro.app`. Non serve nessuna email vera.)

## 4. Database

**Build → Firestore Database → Crea database** → posizione **`europe-west1 (Belgio)`** → **modalità produzione** → Crea.
Usa proprio `europe-west1`: è la stessa zona delle funzioni dell'app.

## 5. Registra l'app web e mandami i dati

1. **Impostazioni progetto** (ingranaggio) → **Le tue app** → icona **`</>`** (Web) → nome `Epicuro` → **Registra app**.
2. Copia il blocco `firebaseConfig` che compare (apiKey, authDomain, projectId…).
3. **Impostazioni progetto → Cloud Messaging → Certificati push web → Genera coppia di chiavi** e copia la chiave.
4. **Incolla entrambi nella chat con Claude.** Questi dati non sono segreti: servono al telefono per trovare il progetto. Li inserisco io in `public/config.js`.

## 6. Collega GitHub a Firebase (una volta sola, dal browser)

Così ogni modifica fatta da Claude va online da sola, senza computer.

**a) Chiave per GitHub**
1. Firebase → **Impostazioni progetto → Account di servizio → Genera nuova chiave privata** → si scarica un file `.json`.
2. Vai su <https://console.cloud.google.com/iam-admin/iam> (stesso account Google, progetto `epicuro-varese`), trova la riga `firebase-adminsdk-…` → matita → **Aggiungi un altro ruolo** → **Proprietario** → Salva.
   La chiave diventa una "chiave di casa" del progetto: non va mai inviata a nessuno né incollata in chat.

**b) Inseriscila in GitHub**
1. Apri il repository `epicuro-app` su GitHub → **Settings → Secrets and variables → Actions**.
2. Scheda **Secrets** → **New repository secret** → nome `FIREBASE_SERVICE_ACCOUNT` → incolla **tutto** il contenuto del file `.json` → **Add secret**. Poi cancella il file dal computer o dal telefono.
3. Scheda **Variables** → **New repository variable** → nome `FIREBASE_PROJECT_ID` → valore: l'ID del progetto (es. `epicuro-varese`).

**c) Prima pubblicazione**
Repository → **Actions** → **Pubblica su Firebase** → **Run workflow**. Dopo 3–5 minuti compare la spunta verde: l'app è online su **`https://ID-PROGETTO.web.app`**.
Da quel momento ogni modifica fatta da Claude si pubblica da sola.

**Consiglio:** rendi il repository privato: **Settings → General → Danger Zone → Change visibility → Private**. Resta gratuito.

<details><summary>In alternativa: pubblicare dal computer</summary>

Con Node.js 20 installato, nella cartella del progetto:

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
firebase use --add
```

```bash
cd functions && npm install && cd ..
```

```bash
firebase deploy
```
</details>

## 7. Primo avvio

1. Apri l'indirizzo dal tuo telefono **subito dopo la pubblicazione**: la prima persona che entra crea l'account **amministratore**. Scegli nome, nome utente e password.
2. **Turni → Utenti** → aggiungi ogni dipendente (nome, nome utente, password; ne viene proposta una già pronta).
3. Tocca **Copia messaggio** e invialo alla persona su WhatsApp: contiene link, nome utente e password.
4. Per far installare l'app: **Utenti → QR per scaricare l'app**. Fallo inquadrare con la fotocamera, oppure tocca **Stampa locandina** e appendila nel retro. Il QR contiene solo il link: per entrare servono comunque nome utente e password.

## 8. Sul telefono di ogni dipendente

- **iPhone** (serve iOS 16.4 o successivo): apri il link in **Safari** → tasto **Condividi** → **Aggiungi alla schermata Home**. Apri Epicuro **dall'icona**, entra, e tocca **Attiva** nella scheda delle notifiche.
- **Android**: apri il link in **Chrome** → menu ⋮ → **Installa app** (o "Aggiungi a schermata Home"). Entra e tocca **Attiva** per le notifiche.

Ognuno può cambiare la propria password toccando il proprio nome in alto a destra.

---

## Come si usa

| Sezione | Tutti | Solo amministratore |
|---|---|---|
| **Home** | Benvenuto, meteo di oggi a Varese (21100), prenotazioni del giorno, chi è in turno, vini da riordinare | — |
| **Prenotazioni** | Inserire, modificare, cancellare (orario, nome, telefono, persone, nota) | — |
| **Turni** | Vedere i turni **pubblicati**; segnare i giorni in cui non si è disponibili | Creare la bozza, **Pubblica** (con notifica), **Ritira**, **Svuota**, eliminare singoli turni, gestire utenti e password |
| **Cantina** | Segnare le bottiglie vendute (si annulla entro 30 minuti) | Aggiungere/importare vini, cambiare quantità e scorta minima |

**Turni:** l'amministratore lavora su una **bozza** che lo staff non vede. Con **Pubblica** lo staff vede la settimana e ognuno riceve sul telefono i **propri** turni (es. "I tuoi 3 turni: Mer 18:00–02:00, …"). Se sbagli: modifichi o elimini i turni e ripubblichi, oppure **Ritira** per toglierli subito allo staff. I turni vanno dalle 10:00 alle 02:00. La giornata cambia alle 06:00, quindi dopo mezzanotte "oggi" è ancora la serata in corso.

**Indisponibilità:** ognuno le segna dal calendario in **Turni**. L'amministratore le vede sotto ogni giorno ("Non disponibili: …") e riceve un avviso se assegna un turno a chi non c'è.

## Modificare l'app in futuro

Apri una sessione su claude.ai/code con il repository `epicuro-app` e chiedi la modifica in italiano. Claude modifica il codice, lancia i test e lo carica su GitHub: l'app online si aggiorna da sola in pochi minuti.

## Privacy

Le prenotazioni contengono nomi e numeri di telefono dei clienti. Restano nel database del locale, visibili solo agli utenti dell'app. Rimuovi subito dall'app chi non lavora più al locale (**Utenti → Rimuovi**).
