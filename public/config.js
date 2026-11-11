/* Epicuro Staff — configurazione Firebase.
 * Incolla qui i valori del tuo progetto (Console Firebase → Impostazioni progetto → Le tue app → App web).
 * VAPID_KEY: Console Firebase → Impostazioni progetto → Cloud Messaging → Certificati push web → "Coppia di chiavi".
 * Questo file è letto sia dall'app sia dal service worker delle notifiche.
 */
self.EPICURO_CONFIG = {
  firebase: {
    apiKey: "INSERISCI_API_KEY",
    authDomain: "INSERISCI_PROGETTO.firebaseapp.com",
    projectId: "INSERISCI_PROGETTO",
    storageBucket: "INSERISCI_PROGETTO.appspot.com",
    messagingSenderId: "INSERISCI_SENDER_ID",
    appId: "INSERISCI_APP_ID"
  },
  vapidKey: "INSERISCI_VAPID_KEY",
  region: "europe-west1"
};
