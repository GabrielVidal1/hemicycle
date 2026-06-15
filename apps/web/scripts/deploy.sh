#!/usr/bin/env bash
# Deploy the production build to zipgo on raspy2 (internet HTTPS).
#
# zipgo routing convention: inside a domain folder, a SUBDOMAIN folder must end
# in a TRAILING DOT, and subdomains nest under the apex domain folder. A folder
# without a trailing dot is served as a path under the apex, NOT a subdomain.
#   domains/gabvdl.xyz/dev./hemicycle.  ->  https://hemicycle.dev.gabvdl.xyz
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_DEST="raspy2:/home/gabrielvidal/services/domains/gabvdl.xyz/dev./hemicycle."
URL="https://hemicycle.dev.gabvdl.xyz"
PORT="5173"

RSYNC_OPTS=(-avz --delete)

# Tailscale IP of this homelab host (for dev server access).
TS_IP="$(tailscale ip -4 2>/dev/null | head -1)"
: "${TS_IP:=100.104.50.115}"

if [ ! -d "$PROJECT_DIR/dist" ]; then
  echo "error: $PROJECT_DIR/dist not found — run 'npm run build' first." >&2
  exit 1
fi

# Ensure the dev. subdomain folder exists on raspy2.
ssh raspy2 'mkdir -p /home/gabrielvidal/services/domains/gabvdl.xyz/dev.'

# --delete keeps the target an exact mirror of dist/ (removes stale files).
rsync "${RSYNC_OPTS[@]}" "$PROJECT_DIR/dist/" "$REMOTE_DEST"
echo "✓ Deployed to raspy2 (internet HTTPS): $REMOTE_DEST"

# og:image + social meta (best-effort). The page is now live, so screenshot it,
# write dist/og-image.png + patch the og:/twitter: <head> tags, then re-sync so
# the image and tags go live. A screenshot failure must not fail the deploy.
OG_SKILL="$HOME/homelab/.claude/skills/og-screenshot/scripts/og-screenshot.sh"
if [ -x "$OG_SKILL" ]; then
  if bash "$OG_SKILL" "$URL" --project "$PROJECT_DIR"; then
    rsync "${RSYNC_OPTS[@]}" "$PROJECT_DIR/dist/" "$REMOTE_DEST"
    echo "✓ og:image + social meta updated and re-synced"
  else
    echo "  (og:image step skipped — screenshot failed)"
  fi
fi

echo ""
echo "  Deployed URL : $URL   (via raspy2, Let's Encrypt HTTPS)"
echo "  Dev URL      : http://$TS_IP:$PORT   (npm run dev; Tailscale-reachable)"
