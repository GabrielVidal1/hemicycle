#!/usr/bin/env bash
# Copy the EP votes dataset (raw JSON) into public/ so the app fetches it at
# runtime as static assets, instead of Vite bundling ~64 MB of JSON-as-JS
# (which OOMs the bundler). Runs as a prebuild step.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$HERE/node_modules/@hemicycle/european-parliament-votes/data"
[ -d "$SRC" ] || SRC="$HERE/../../data/european-parliament-votes/data"
DEST="$HERE/public/data"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -RL "$SRC/." "$DEST/"
echo "✓ copied EP dataset → public/data ($(du -sh "$DEST" | cut -f1))"
