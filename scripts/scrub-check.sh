#!/usr/bin/env bash
# Scrub check: nothing that will be committed may carry personal information, secrets, or private paths.
# Scans every tracked and unignored text file. Exit 1 on any hit.
#
# Generic patterns live here. A maintainer's own private word list (names, project ids, client names) lives in
# scripts/scrub-patterns.local, one regex per line, which is gitignored and never published.
set -u
cd "$(dirname "$0")/.."
GENERIC='[A-Za-z0-9._%+-]+@(gmail|icloud|yahoo|outlook|hotmail)\.com|/Users/[A-Za-z0-9._-]+/|/home/[A-Za-z0-9._-]+/|Mobile Documents|Application Support|gho_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY|nfp_[A-Za-z0-9]{20,}|sbp_[A-Za-z0-9]{20,}'
PATTERN="$GENERIC"
if [ -f scripts/scrub-patterns.local ]; then
  LOCAL=$(grep -v '^\s*$' scripts/scrub-patterns.local | grep -v '^#' | paste -sd '|' -)
  [ -n "$LOCAL" ] && PATTERN="$GENERIC|$LOCAL"
fi
FILES=$(git ls-files -co --exclude-standard 2>/dev/null | grep -vE '\.(pdf|zip|png|jpg|jpeg|gif|ico|woff2?)$' | grep -v '^scripts/scrub-patterns.local$' | grep -v '^scripts/scrub-check.sh$')
HITS=""
if [ -n "$FILES" ]; then HITS=$(echo "$FILES" | xargs grep -nIiE "$PATTERN" 2>/dev/null || true); fi
if [ -n "$HITS" ]; then
  echo "SCRUB CHECK FAILED. These lines would publish something private:"
  echo "$HITS"
  exit 1
fi
echo "scrub check: clean ($(echo "$FILES" | wc -l | tr -d ' ') files scanned)"
