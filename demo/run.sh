#!/usr/bin/env bash
# Demo locale di Epicuro Staff con dati d'esempio (nessun dato reale).
# Avvia gli emulatori Firebase, carica i dati e apre l'app su http://127.0.0.1:${PORT:-8090}
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ -d functions/node_modules ] || (cd functions && npm ci --silent)
LOG="${TMPDIR:-/tmp}/epicuro-demo-emulators.log"
npx --yes firebase-tools@13.29.1 emulators:start --project demo-epicuro --only auth,firestore,functions > "$LOG" 2>&1 &
EMU=$!
trap 'kill $EMU 2>/dev/null' EXIT
until grep -q "All emulators ready" "$LOG"; do
  if ! kill -0 $EMU 2>/dev/null; then echo "Gli emulatori non sono partiti: vedi $LOG"; exit 1; fi
  sleep 1
done
node demo/seed.js
node demo/server.js
