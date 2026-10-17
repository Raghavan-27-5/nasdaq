#!/usr/bin/env bash
# Serve the production build with no Node.js requirement at demo time.
# Python's stdlib http.server is always available and is enough for a
# single-page app with relative asset paths.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f dist/index.html ]; then
  echo "dist/ not found - run 'npm run build' first." >&2
  exit 1
fi

PORT="${1:-4173}"
echo
echo "  Nasdaq AI Quant Research Terminal"
echo "  ------------------------------------------------"
echo "  http://localhost:${PORT}/"
echo
echo "  NOTE: this build mixes real versioned artifacts with labelled placeholders."
echo "  Full per-surface status is on the in-app Research Audit page."
echo "  Press Ctrl+C to stop."
echo
exec python3 -m http.server "$PORT" --directory dist --bind 127.0.0.1
