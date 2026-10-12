#!/usr/bin/env node
// Drydock hooks. One file, one event per invocation: node hooks.mjs <sessionstart|stop|pretool|posttool|precompact>
// Every hook does NOTHING unless the project has .drydock/config.json, and every hook fails open:
// any error -> exit 0, so a broken hook can never trap the owner.
//
// Which failure each hook stops (and when to retire it):
//   stop        "Claude says done when it isn't."  Holds a completion claim while the segment's test command is red. Cap 3, then releases loudly.
//               Retire when the model reliably runs the exit test itself before claiming (check: zero blocks across ten segments).
//   pretool     Nothing publishes without the owner's go for that exact step (git push, deploy to production, publish).
//               Never retire: this is the owner-gate, a value, not a model limitation.
//   posttool    "Fixes break other things."  Runs the typecheck after an edit so a break is seen at the edit, not at the end.
//               Retire when the stack has no typecheck.
//   precompact  "Context lost."  Writes a snapshot before the conversation is compacted.
//   sessionstart "Context lost."  Tells a fresh session where the build stands and to run /drydock:wake.
import fs from 'node:fs';
import path from 'node:path';
import { findRoot, isDrydockProject, readConfig, readState, writeState, readJson, writeJson, run, tail, nowIso, DRYDOCK_DIR } from './lib.mjs';

const event = (process.argv[2] || '').toLowerCase();

function readStdin() {
  try { const s = fs.readFileSync(0, 'utf8'); return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function emit(obj) { process.stdout.write(JSON.stringify(obj)); }
function done() { process.exit(0); }

try {
  const input = readStdin();
  const cwd = input.cwd || process.cwd();
  const root = findRoot(cwd);
  if (!isDrydockProject(root)) done();
  const cfg = readConfig(root);
  const handlers = { sessionstart, stop, pretool, posttool, precompact };
  if (!handlers[event]) done();
  handlers[event](input, root, cfg);
  done();
} catch {
  done();
}

function sessionstart(input, root, cfg) {
  const st = readState(root);
  const last = readJson(path.join(root, DRYDOCK_DIR, 'last-test.json'), null);
  let mapLine = 'no BUILD-MAP.md yet (the owner should run /drydock:plan)';
  try {
    const m = readJson(path.join(root, DRYDOCK_DIR, 'map-cache.json'), null);
    const text = fs.existsSync(path.join(root, 'BUILD-MAP.md')) ? fs.readFileSync(path.join(root, 'BUILD-MAP.md'), 'utf8') : '';
    if (text) {
      const ids = [...text.matchAll(/^##\s+(S\d+[a-z]?)\s*[—–:\-]+\s*(.+)$/gim)];
      const greens = (text.match(/\*\*Status:\*\*\s*green/gi) || []).length;
      mapLine = `${greens} of ${ids.length} segments green`;
    }
    void m;
  } catch { /* ignore */ }
  const snaps = fs.existsSync(path.join(root, DRYDOCK_DIR, 'snapshots')) ? fs.readdirSync(path.join(root, DRYDOCK_DIR, 'snapshots')).sort().slice(-1) : [];
  const compacted = input.source === 'compact';
  const lines = [
    `DRYDOCK PROJECT: ${cfg.project.name || path.basename(root)}. Tier ${cfg.tier}. Owner level: ${cfg.owner.level}. Map: ${mapLine}.`,
    `Active segment: ${st.activeSegment || 'none'} (stop-gate ${st.gate}). Last test: ${last ? (last.code === 0 ? 'GREEN' : 'RED') + ' at ' + last.at : 'never run'}.`,
    snaps.length ? `Newest snapshot: ${path.join(DRYDOCK_DIR, 'snapshots', snaps[0])}.` : '',
    compacted ? 'The conversation was just compacted. Before continuing, re-read STATE.md and the newest snapshot, and restate the active segment and its exit test in one line.' : 'If the owner has not said what to do, start with /drydock:wake. Follow the Drydock voice rules: plain English, one step at a time, evidence before any claim of done.',
  ].filter(Boolean).join('\n');
  emit({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.slice(0, 9000) } });
}

function stop(input, root, cfg) {
  if (input.stop_hook_active) return;
  const st = readState(root);
  if (!st.activeSegment || st.gate !== 'on') return;
  const msg = String(input.last_assistant_message || '');
  const claim = /drydock claim:/i.test(msg)
    || /\b(exit test (is |are )?(met|passes|passing|green)|segment (is )?(done|complete|finished)|all (the )?(tests|checks) (pass|are passing|are green|green)|ready to ship|marked (it )?green)\b/i.test(msg);
  if (!claim) return;
  const limit = Number(cfg.limits.stopHookBlocks || 3);
  if (st.blocks >= limit) {
    writeState(root, { ...st, gate: 'released' });
    emit({ systemMessage: `Drydock: the stop-gate released after ${limit} red checks in a row on ${st.activeSegment}. The exit test is NOT proven. The owner should be told that plainly.` });
    return;
  }
  const testCmd = cfg.commands.test;
  if (!testCmd) return;
  const r = run(testCmd, { cwd: root, timeoutMs: 240000 });
  const rec = { at: nowIso(), cmd: testCmd, code: r.code, timedOut: r.timedOut, tail: tail(r.out, 60, 6000), by: 'stop-hook' };
  writeJson(path.join(root, DRYDOCK_DIR, 'last-test.json'), rec);
  if (r.code === 0) return;
  writeState(root, { ...st, blocks: (st.blocks || 0) + 1 });
  emit({
    decision: 'block',
    reason: `Drydock stop-gate: you claimed ${st.activeSegment} is done, but the project's test command is RED (\`${testCmd}\` exited ${r.code}${r.timedOut ? ', timed out' : ''}). Do not tell the owner it is done. Read the failure below, fix the cause (not the test), run \`node "${path.join(process.argv[1] ? path.dirname(process.argv[1]) : '', 'drydock.mjs')}" test\` yourself, and only then restate the claim with the evidence. If you are genuinely stuck, say so to the owner instead of claiming, and run: drydock gate release. (Red check ${(st.blocks || 0) + 1} of ${limit}.)\n\n--- test output (tail) ---\n${tail(r.out, 40, 3500)}`,
  });
}

function pretool(input, root, cfg) {
  if (input.tool_name !== 'Bash') return;
  const c = String((input.tool_input && input.tool_input.command) || '');
  const rules = [
    { re: /\bgit\s+push\b/, kind: 'push', what: 'push code to GitHub (anyone with access to the repo will see it)' },
    { re: /\bgh\s+repo\s+create\b/, kind: 'push', what: 'create a GitHub repository' },
    { re: /\bnpm\s+publish\b/, kind: 'push', what: 'publish a package to npm' },
    { re: /\bnetlify\s+deploy\b[^\n]*--prod\b/, kind: 'deploy', what: 'deploy to the LIVE site' },
    { re: /\bvercel\b[^\n]*--prod\b/, kind: 'deploy', what: 'deploy to the LIVE site' },
    { re: /\bsupabase\s+db\s+push\b/, kind: 'deploy', what: 'change the live database structure' },
    { re: /\bsupabase\s+functions\s+deploy\b/, kind: 'deploy', what: 'deploy server code to the live project' },
  ];
  const hit = rules.find((r) => r.re.test(c));
  if (!hit) return;
  const token = path.join(root, DRYDOCK_DIR, 'gates', hit.kind);
  const minutes = Number(cfg.limits.gateTokenMinutes || 15);
  if (fs.existsSync(token)) {
    const ageMin = (Date.now() - fs.statSync(token).mtimeMs) / 60000;
    try { fs.unlinkSync(token); } catch { /* ignore */ }
    if (ageMin <= minutes) {
      emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: `Drydock owner-gate: the owner's go for this ${hit.kind} was recorded ${ageMin.toFixed(1)} minutes ago.` } });
      return;
    }
  }
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: cfg.gate && cfg.gate.pushAsk === false ? 'allow' : 'ask',
      permissionDecisionReason: `Drydock owner-gate. This command would ${hit.what}. Nothing leaves this computer without your go for this exact step. Approve only if you meant to do this right now; otherwise deny and nothing happens.`,
    },
  });
}

function posttool(input, root, cfg) {
  const tc = cfg.commands.typecheck;
  if (!tc) return;
  const file = String((input.tool_input && (input.tool_input.file_path || input.tool_input.path)) || '');
  if (!/\.(ts|tsx|mts|cts|js|jsx|mjs|vue|svelte)$/i.test(file)) return;
  const stampFile = path.join(root, DRYDOCK_DIR, 'last-typecheck.json');
  const last = readJson(stampFile, null);
  const debounceMs = Number(cfg.limits.typecheckDebounceSeconds || 20) * 1000;
  if (last && Date.now() - new Date(last.at).getTime() < debounceMs) return;
  const r = run(tc, { cwd: root, timeoutMs: 90000 });
  writeJson(stampFile, { at: nowIso(), cmd: tc, code: r.code });
  if (r.code === 0) return;
  emit({ decision: 'block', reason: `Drydock typecheck after editing ${path.basename(file)}: \`${tc}\` exited ${r.code}. Fix this before moving on.\n${tail(r.out, 30, 3000)}` });
}

function precompact(input, root) {
  const cli = path.join(path.dirname(process.argv[1] || ''), 'drydock.mjs');
  run(`node "${cli}" snapshot --root "${root}"`, { cwd: root, timeoutMs: 20000 });
}
