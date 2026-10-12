#!/usr/bin/env bash
# Builds dist/Drydock-Playbook.pdf from playbook/playbook.html and dist/Drydock-Setup-Checklist.pdf from install/checklist.html (Chrome headless).
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome || command -v chromium || true)"
[ -n "$CHROME" ] || { echo "Chrome not found"; exit 1; }
mkdir -p dist
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=4000 --print-to-pdf="$(pwd)/dist/Drydock-Playbook.pdf" "file://$(pwd)/playbook/playbook.html" 2>/dev/null
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=4000 --print-to-pdf="$(pwd)/dist/Drydock-Setup-Checklist.pdf" "file://$(pwd)/install/checklist.html" 2>/dev/null
ls -la dist/*.pdf
