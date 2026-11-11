#!/usr/bin/env bash
# Esegue i test completi di Epicuro Staff sugli emulatori Firebase (nessun dato reale toccato).
# Requisiti: Node 20+, Java 11+, Playwright con Chromium (require('playwright') funzionante).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -r "$ROOT/firebase.json" "$ROOT/firestore.rules" "$ROOT/firestore.indexes.json" "$ROOT/public" "$TMP/"
mkdir -p "$TMP/functions" && cp "$ROOT/functions/index.js" "$ROOT/functions/package.json" "$ROOT/functions/package-lock.json" "$TMP/functions/"
cat > "$TMP/public/config.js" <<'CFG'
self.EPICURO_CONFIG = {
  firebase: { apiKey: "demo-key", authDomain: "demo-epicuro.firebaseapp.com", projectId: "demo-epicuro", storageBucket: "demo-epicuro.appspot.com", messagingSenderId: "1", appId: "1:1:web:1" },
  vapidKey: "demo", region: "europe-west1"
};
CFG
(cd "$TMP/functions" && npm ci --silent)
export SHOTS_DIR="${SHOTS_DIR:-$ROOT/tests/shots}"
cd "$TMP"
npx --yes firebase-tools@13.29.1 emulators:exec --project demo-epicuro --only auth,firestore,functions,hosting \
  "node '$ROOT/tests/e2e.js'"
