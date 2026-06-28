#!/usr/bin/env bash
# Deploy eu.hemicycle.dev to zipgo on raspy2 (internet HTTPS, Let's Encrypt).
#   domains/hemicycle.dev/eu./  ->  https://eu.hemicycle.dev
# raspy2's Traefik already routes *.hemicycle.dev; Caddy auto-issues the cert.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_DEST="raspy2:/home/gabrielvidal/services/domains/hemicycle.dev/eu./"
URL="https://eu.hemicycle.dev"

if [ ! -d "$PROJECT_DIR/dist" ]; then
  echo "error: $PROJECT_DIR/dist not found — run 'npm run build' first." >&2
  exit 1
fi

ssh raspy2 'mkdir -p "/home/gabrielvidal/services/domains/hemicycle.dev/eu."'
rsync -avz --delete "$PROJECT_DIR/dist/" "$REMOTE_DEST"
echo "✓ Synced dist/ → $REMOTE_DEST"

ssh raspy2 'cd ~/services && docker compose restart zipgo' >/dev/null 2>&1 || true
echo "✓ zipgo restarted"
echo ""
echo "  Live: $URL  (Let's Encrypt via raspy2)"
