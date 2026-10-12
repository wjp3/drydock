// Drydock shared helpers. Plain Node, no dependencies, runs on Mac, Windows, Linux.
// Everything here is deterministic: no model, no network.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const DRYDOCK_DIR = '.drydock';

export function findRoot(start) {
  let dir = path.resolve(start || process.cwd());
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, DRYDOCK_DIR, 'config.json')) || fs.existsSync(path.join(dir, 'BUILD-MAP.md'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(start || process.cwd());
}

export function isDrydockProject(root) {
  return fs.existsSync(path.join(root, DRYDOCK_DIR, 'config.json'));
}

export const DEFAULT_CONFIG = {
  version: 1,
  project: { name: '', oneLiner: '' },
  owner: { level: 'non-coder', plan: 'unknown', os: process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'mac' : 'linux') },
  tier: 'lite',
  stack: { kind: '', frontend: '', database: 'none', hosting: '', repo: 'github' },
  commands: { install: '', dev: '', test: '', typecheck: '', build: '', e2e: '' },
  urls: { preview: '', live: '', repo: '' },
  gate: { pushAsk: true },
  panels: { rosterFile: 'docs/PANEL.md' },
  limits: { stopHookBlocks: 3, gateTokenMinutes: 15, typecheckDebounceSeconds: 20 },
};

export function deepMerge(base, extra) {
  if (Array.isArray(base) || Array.isArray(extra) || typeof base !== 'object' || typeof extra !== 'object' || !base || !extra) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const k of Object.keys(extra)) out[k] = k in base ? deepMerge(base[k], extra[k]) : extra[k];
  return out;
}

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
}

export function readConfig(root) {
  const file = path.join(root, DRYDOCK_DIR, 'config.json');
  return deepMerge(DEFAULT_CONFIG, readJson(file, {}));
}

export function writeConfig(root, cfg) {
  writeJson(path.join(root, DRYDOCK_DIR, 'config.json'), cfg);
}

export function statePath(root) { return path.join(root, DRYDOCK_DIR, 'state.json'); }
export function readState(root) {
  return readJson(statePath(root), { activeSegment: null, gate: 'off', blocks: 0, startedAt: null, frozenPath: null });
}
export function writeState(root, st) { writeJson(statePath(root), st); }

export function nowIso() { return new Date().toISOString(); }
export function today() { return new Date().toISOString().slice(0, 10); }
export function stamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }

export function sha256(text) { return crypto.createHash('sha256').update(text).digest('hex'); }

export function normalizeWs(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

// Run a shell command, capture output, never throw. Returns { code, out, timedOut }.
export function run(cmd, { cwd, timeoutMs = 240000, env } = {}) {
  if (!cmd || !String(cmd).trim()) return { code: 0, out: '', skipped: true };
  const res = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', timeout: timeoutMs, env: { ...process.env, ...(env || {}), CI: process.env.CI || '1', FORCE_COLOR: '0' }, maxBuffer: 16 * 1024 * 1024 });
  const out = `${res.stdout || ''}${res.stderr ? '\n' + res.stderr : ''}`;
  const timedOut = !!(res.error && res.error.code === 'ETIMEDOUT');
  const code = timedOut ? 124 : (typeof res.status === 'number' ? res.status : 1);
  return { code, out, timedOut };
}

export function tail(text, lines = 40, maxChars = 4000) {
  const arr = String(text || '').split(/\r?\n/);
  let t = arr.slice(-lines).join('\n');
  if (t.length > maxChars) t = t.slice(-maxChars);
  return t;
}

// ---------- BUILD-MAP.md parsing (the map format is specified in reference/map-format.md) ----------
const HEAD_RE = /^##\s+(S\d+[a-z]?)\s*(?:[—–:\-]+)\s*(.+?)\s*$/i;

export function parseMap(text) {
  const lines = String(text || '').split(/\r?\n/);
  const segments = [];
  let cur = null;
  lines.forEach((line, i) => {
    const m = line.match(HEAD_RE);
    if (m) { cur = { id: m[1].toUpperCase(), title: m[2].trim(), headingLine: i, lines: [], lineStart: i }; segments.push(cur); return; }
    if (/^##?\s/.test(line) && !/^###/.test(line)) { cur = null; return; }
    if (cur) cur.lines.push(line);
  });
  for (const s of segments) {
    s.status = (field(s.lines, 'Status') || 'todo').toLowerCase().split(/\s/)[0];
    s.mode = ((field(s.lines, 'Mode') || 'SOLO').split(/[\s(]/)[0] || 'SOLO').toUpperCase();
    s.size = (field(s.lines, 'Size') || '').split(/[\s(]/)[0].toUpperCase();
    s.dependsOn = (field(s.lines, 'Depends on') || '').split(/[,\s]+/).filter((x) => /^S\d/i.test(x)).map((x) => x.toUpperCase());
    s.whatYouCanDo = field(s.lines, "What you can do when it's done") || field(s.lines, 'What you can do') || '';
    s.howWeCheck = field(s.lines, "How we'll check it") || field(s.lines, 'How we check it') || '';
    s.clauses = exitClauses(s.lines, s.id);
    delete s.lines;
  }
  const mvpLine = (text.match(/\*\*MVP line:\*\*\s*(.+)/i) || [])[1] || '';
  const finishedLine = (text.match(/\*\*Finished line:\*\*\s*(.+)/i) || [])[1] || '';
  return { segments, mvpLine: mvpLine.trim(), finishedLine: finishedLine.trim() };
}

function field(lines, name) {
  const re = new RegExp('^\\s*[-*]\\s*\\*\\*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':?\\*\\*:?\\s*(.*)$', 'i');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (m) {
      let val = m[1].trim();
      // multi-line value: indented continuation lines that are not sub-bullets
      let j = i + 1;
      while (j < lines.length && /^\s{2,}\S/.test(lines[j]) && !/^\s{2,}[-*]\s/.test(lines[j])) { val += ' ' + lines[j].trim(); j++; }
      return val;
    }
  }
  return '';
}

function exitClauses(lines, segId) {
  const idx = lines.findIndex((l) => /^\s*[-*]\s*\*\*Exit test:?\*\*/i.test(l));
  if (idx < 0) return [];
  const clauses = [];
  const inline = lines[idx].replace(/^\s*[-*]\s*\*\*Exit test:?\*\*:?\s*/i, '').trim();
  if (inline) clauses.push(inline);
  for (let j = idx + 1; j < lines.length; j++) {
    const l = lines[j];
    if (!l.trim()) { if (j + 1 < lines.length && /^\s{2,}[-*]\s/.test(lines[j + 1])) continue; break; }
    const m = l.match(/^\s{2,}[-*]\s*(?:\[[ xX]\]\s*)?(.+?)\s*$/);
    if (m) { clauses.push(m[1]); continue; }
    break;
  }
  return clauses.map((text, i) => ({ id: `${segId}.${i + 1}`, text }));
}

export function mapPath(root) { return path.join(root, 'BUILD-MAP.md'); }
export function readMap(root) {
  const file = mapPath(root);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  return { file, text, hash: sha256(text), ...parseMap(text) };
}

// Set a field on one card (Status, Mode...). Inserts the field after the heading if absent.
export function setCardField(root, segId, name, value) {
  const file = mapPath(root);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => { const m = l.match(HEAD_RE); return m && m[1].toUpperCase() === segId.toUpperCase(); });
  if (start < 0) throw new Error(`segment ${segId} not found in BUILD-MAP.md`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^##\s/.test(lines[i])) { end = i; break; }
  const re = new RegExp('^(\\s*[-*]\\s*\\*\\*' + name + ':?\\*\\*:?\\s*)(.*)$', 'i');
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(re);
    if (m) { lines[i] = `${m[1]}${value}`; fs.writeFileSync(file, lines.join('\n')); return; }
  }
  lines.splice(start + 1, 0, `- **${name}:** ${value}`);
  fs.writeFileSync(file, lines.join('\n'));
}

// Tick or untick the exit-test checkboxes of one card.
export function tickCard(root, segId, checked) {
  const file = mapPath(root);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => { const m = l.match(HEAD_RE); return m && m[1].toUpperCase() === segId.toUpperCase(); });
  if (start < 0) return;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    lines[i] = lines[i].replace(/^(\s{2,}[-*]\s*)\[[ xX]\]/, `$1[${checked ? 'x' : ' '}]`);
  }
  fs.writeFileSync(file, lines.join('\n'));
}

export function freezeSegment(root, segId) {
  const map = readMap(root);
  if (!map) throw new Error('BUILD-MAP.md not found. Run /drydock:plan first.');
  const seg = map.segments.find((s) => s.id === segId.toUpperCase());
  if (!seg) throw new Error(`segment ${segId} not found in BUILD-MAP.md`);
  if (!seg.clauses.length) throw new Error(`segment ${segId} has no exit test clauses. Add "- **Exit test:**" with indented "- [ ]" clauses to its card.`);
  return { segment: seg.id, title: seg.title, mode: seg.mode, mapPath: path.relative(root, map.file), mapHash: map.hash, extractedAt: nowIso(), clauses: seg.clauses };
}

// Control A diff: graded = { segment, clauseVerdicts: [{clauseId, echoedText, met, evidence}] }
export function diffGraded(frozen, graded) {
  const problems = [];
  if (!graded || !Array.isArray(graded.clauseVerdicts)) return { ok: false, problems: ['graded file has no clauseVerdicts array'], allMet: false };
  if (graded.segment && frozen.segment && graded.segment.toUpperCase() !== frozen.segment.toUpperCase()) problems.push(`segment mismatch: frozen ${frozen.segment}, graded ${graded.segment}`);
  const byId = new Map(graded.clauseVerdicts.map((v) => [String(v.clauseId), v]));
  let allMet = true;
  for (const c of frozen.clauses) {
    const v = byId.get(c.id);
    if (!v) { problems.push(`dropped: ${c.id} has no verdict`); allMet = false; continue; }
    if (normalizeWs(v.echoedText) !== normalizeWs(c.text)) problems.push(`softened: ${c.id} echoed text differs from the frozen clause.\n  frozen: ${c.text}\n  echoed: ${v.echoedText}`);
    if (v.met !== true) allMet = false;
    if (v.met === true && !normalizeWs(v.evidence)) problems.push(`unbacked: ${c.id} is marked met with no evidence`);
  }
  const known = new Set(frozen.clauses.map((c) => c.id));
  for (const v of graded.clauseVerdicts) if (!known.has(String(v.clauseId))) problems.push(`added: verdict for unknown clause ${v.clauseId}`);
  return { ok: problems.length === 0, problems, allMet: allMet && problems.length === 0 };
}
