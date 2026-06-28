#!/usr/bin/env bash
# Deploy fr.hemicycle.dev to zipgo on raspy2 (internet HTTPS, Let's Encrypt).
#
# zipgo serves each subdomain from a trailing-dot folder under the domain dir:
#   domains/hemicycle.dev/fr./  ->  https://fr.hemicycle.dev
# raspy2's Traefik already routes *.hemicycle.dev (HostRegexp); Caddy auto-issues
# the cert on the first HTTPS request once the folder exists.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_DEST="raspy2:/home/gabrielvidal/services/domains/hemicycle.dev/fr./"
URL="https://fr.hemicycle.dev"

if [ ! -d "$PROJECT_DIR/dist" ]; then
  echo "error: $PROJECT_DIR/dist not found — run 'npm run build' first." >&2
  exit 1
fi

ssh raspy2 'mkdir -p "/home/gabrielvidal/services/domains/hemicycle.dev/fr."'
rsync -avz --delete "$PROJECT_DIR/dist/" "$REMOTE_DEST"
echo "✓ Synced dist/ → $REMOTE_DEST"

# Pick up the new subdomain folder + request the cert.
ssh raspy2 'cd ~/services && docker compose restart zipgo' >/dev/null 2>&1 || true
echo "✓ zipgo restarted"
echo ""
echo "  Live: $URL  (Let's Encrypt via raspy2)"
