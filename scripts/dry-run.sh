#!/usr/bin/env bash
# Drydock dry run: proves the plugin loads and the deterministic parts behave, in a throwaway project.
# Usage: scripts/dry-run.sh [--with-claude]   (--with-claude also runs a real non-interactive /drydock:help)
set -u
cd "$(dirname "$0")/.."
ROOT=$(pwd)
CLI="$ROOT/plugin/scripts/drydock.mjs"
HOOKS="$ROOT/plugin/scripts/hooks.mjs"
FAIL=0
step() { printf '\n== %s\n' "$1"; }
ok() { echo "   ok: $1"; }
bad() { echo "   FAIL: $1"; FAIL=1; }

step "syntax"
for f in plugin/scripts/*.mjs plugin/workflows/*.js; do node --check "$f" && ok "$f" || bad "$f"; done
for f in .claude-plugin/marketplace.json plugin/.claude-plugin/plugin.json plugin/hooks/hooks.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && ok "$f" || bad "$f"; done

step "scrub"
./scripts/scrub-check.sh && ok "clean" || bad "scrub"

step "claude plugin validate"
claude plugin validate ./plugin >/tmp/drydock-validate.txt 2>&1 && ok "plugin" || { cat /tmp/drydock-validate.txt; bad "plugin validate"; }
claude plugin validate . >/tmp/drydock-validate-mp.txt 2>&1 && ok "marketplace" || { cat /tmp/drydock-validate-mp.txt; bad "marketplace validate"; }

step "fixture project"
FX=$(mktemp -d /tmp/drydock-dryrun-XXXX)
( cd "$FX" && git init -q -b main && echo "# fx" > README.md && git add -A && git commit -qm init )
node "$CLI" init --root "$FX" --name Fixture --tier lite >/dev/null && ok "init" || bad "init"
node "$CLI" config set commands.test "node -e \"process.exit(process.env.FX_FAIL?1:0)\"" --root "$FX" >/dev/null
printf '# M\n\n> **MVP line:** after S1\n\n## S1 - Thing\n- **Status:** todo\n- **Mode:** SOLO (x)\n- **Size:** S\n- **Depends on:** none\n- **What you can do when it'"'"'s done:** see it\n- **Exit test:**\n  - [ ] clause one holds\n  - [ ] clause two holds\n' > "$FX/BUILD-MAP.md"
node "$CLI" map list --root "$FX" | grep -q "S1" && ok "map parse" || bad "map parse"
node "$CLI" segment start S1 --root "$FX" >/dev/null && ok "segment start" || bad "segment start"
cat > "$FX/.drydock/runs/S1/graded.json" <<'G'
{"segment":"S1","clauseVerdicts":[{"clauseId":"S1.1","echoedText":"clause one holds","met":true,"evidence":"x"},{"clauseId":"S1.2","echoedText":"clause two holds","met":true,"evidence":"y"}]}
G
node "$CLI" map grade S1 --graded "$FX/.drydock/runs/S1/graded.json" --root "$FX" >/dev/null; [ $? -eq 0 ] && ok "grade exact echo -> 0" || bad "grade exact echo"
sed 's/clause two holds/clause two mostly holds/' "$FX/.drydock/runs/S1/graded.json" > "$FX/.drydock/runs/S1/soft.json"
node "$CLI" map grade S1 --graded "$FX/.drydock/runs/S1/soft.json" --root "$FX" >/dev/null 2>&1; [ $? -eq 1 ] && ok "grade softened -> 1" || bad "grade softened"
node "$CLI" map grade S1 --graded "$FX/.drydock/runs/S1/graded.json" --root "$FX" >/dev/null
node "$CLI" segment done S1 --root "$FX" >/dev/null && grep -q "Status:\*\* green" "$FX/BUILD-MAP.md" && ok "segment done marks green" || bad "segment done"
FX_FAIL=1 node "$CLI" test --root "$FX" >/dev/null 2>&1; [ $? -eq 1 ] && ok "test red -> 1" || bad "test red"
node "$CLI" test --root "$FX" >/dev/null 2>&1 && ok "test green -> 0" || bad "test green"

step "hooks"
node "$CLI" segment start S1 --root "$FX" >/dev/null
OUT=$(echo "{\"cwd\":\"$FX\",\"source\":\"startup\"}" | node "$HOOKS" sessionstart); echo "$OUT" | grep -q "DRYDOCK PROJECT" && ok "sessionstart context" || bad "sessionstart"
OUT=$(FX_FAIL=1 bash -c "echo '{\"cwd\":\"$FX\",\"last_assistant_message\":\"Drydock claim: S1 exit test met.\"}' | node '$HOOKS' stop"); echo "$OUT" | grep -q '"decision":"block"' && ok "stop-gate blocks a red claim" || bad "stop-gate"
OUT=$(echo "{\"cwd\":\"$FX\",\"last_assistant_message\":\"Drydock claim: S1 exit test met.\"}" | node "$HOOKS" stop); [ -z "$OUT" ] && ok "stop-gate silent on green" || bad "stop-gate green"
OUT=$(echo "{\"cwd\":\"$FX\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git push\"}}" | node "$HOOKS" pretool); echo "$OUT" | grep -q '"permissionDecision":"ask"' && ok "push gate asks" || bad "push gate"
node "$CLI" gate open push --root "$FX" >/dev/null
OUT=$(echo "{\"cwd\":\"$FX\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git push\"}}" | node "$HOOKS" pretool); echo "$OUT" | grep -q '"permissionDecision":"allow"' && ok "push gate honors a go" || bad "push gate go"
N=$(mktemp -d); OUT=$(echo "{\"cwd\":\"$N\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git push\"}}" | node "$HOOKS" pretool); [ -z "$OUT" ] && ok "silent outside Drydock projects" || bad "non-drydock silence"

if [ "${1:-}" = "--with-claude" ]; then
  step "real session: /drydock:help (non-interactive, loads the plugin from ./plugin)"
  ( cd "$FX" && claude -p "/drydock:help" --plugin-dir "$ROOT/plugin" --permission-mode dontAsk --max-turns 3 > /tmp/drydock-help.txt 2>&1 )
  grep -qiE "plan|build|check|prove|remember" /tmp/drydock-help.txt && ok "help answered (see /tmp/drydock-help.txt)" || { tail -20 /tmp/drydock-help.txt; bad "help via claude -p"; }
fi

rm -rf "$FX" "$N" 2>/dev/null
echo; [ $FAIL -eq 0 ] && echo "DRY RUN: all green" || { echo "DRY RUN: FAILURES above"; exit 1; }
