#!/usr/bin/env node
// Drydock CLI. Deterministic helpers the skills call. No model, no network.
// Usage: node drydock.mjs <command> [args] [--root <dir>] [--json]
//
// Which failure each command stops:
//   map freeze / map grade  -> "Claude says done when it isn't" (the exit test is frozen verbatim and graded by echo, not paraphrase)
//   test / regression       -> "fixes break other things" (every earlier segment's checks re-run before any new claim)
//   status / snapshot       -> "context lost between sessions"
//   gate                    -> nothing publishes without the owner's go for that exact step
import fs from 'node:fs';
import path from 'node:path';
import {
  findRoot, isDrydockProject, readConfig, writeConfig, readState, writeState, readJson, writeJson,
  readMap, freezeSegment, diffGraded, setCardField, tickCard, run, tail, nowIso, today, stamp, DRYDOCK_DIR, DEFAULT_CONFIG, deepMerge,
} from './lib.mjs';

const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const nxt = argv[i + 1]; if (nxt !== undefined && !nxt.startsWith('--')) { flags[k] = nxt; i++; } else flags[k] = true; }
  else pos.push(a);
}
const [cmd, sub, arg3, arg4] = pos;
const ROOT = flags.root ? path.resolve(String(flags.root)) : findRoot(process.cwd());
const JSON_OUT = !!flags.json;

function out(obj, human) { if (JSON_OUT) console.log(JSON.stringify(obj, null, 2)); else console.log(human ?? JSON.stringify(obj, null, 2)); }
function fail(msg, code = 2) { console.error(`drydock: ${msg}`); process.exit(code); }
function runsDir(seg) { return path.join(ROOT, DRYDOCK_DIR, 'runs', seg); }

const commands = {
  help() {
    console.log(`drydock <command>
  init [--name X] [--tier lite|standard|full] [--level non-coder|fluent|coder] [--plan ...] [--os ...]
  config | config set <dot.key> <value>
  doctor                      what is installed on this machine
  status                      where the build is
  map list | map show <S#> | map freeze <S#> | map grade <S#> --graded <file> | map mark <S#> <status>
  segment start <S#> | segment stop | segment done <S#> | segment current
  test                        run the project's test command, record the result
  regression                  re-run every earlier segment's checks plus the test command
  regression add <S#> <label> <cmd>
  gate open <push|deploy> | gate release | gate status
  snapshot                    write a context snapshot (also run before compaction)
  handoff-path <slug>         the next handoff filename
  all flags: --root <dir> --json`);
  },

  init() {
    fs.mkdirSync(path.join(ROOT, DRYDOCK_DIR, 'gates'), { recursive: true });
    fs.mkdirSync(path.join(ROOT, DRYDOCK_DIR, 'snapshots'), { recursive: true });
    fs.mkdirSync(path.join(ROOT, DRYDOCK_DIR, 'runs'), { recursive: true });
    for (const d of ['docs/reviews', 'docs/handoffs', 'docs/proofs']) fs.mkdirSync(path.join(ROOT, d), { recursive: true });
    const existing = readJson(path.join(ROOT, DRYDOCK_DIR, 'config.json'), {});
    const cfg = deepMerge(DEFAULT_CONFIG, existing);
    if (flags.name) cfg.project.name = String(flags.name);
    if (flags.tier) cfg.tier = String(flags.tier);
    if (flags.level) cfg.owner.level = String(flags.level);
    if (flags.plan) cfg.owner.plan = String(flags.plan);
    if (flags.os) cfg.owner.os = String(flags.os);
    writeConfig(ROOT, cfg);
    if (!fs.existsSync(path.join(ROOT, DRYDOCK_DIR, 'state.json'))) writeState(ROOT, readState(ROOT));
    if (!fs.existsSync(path.join(ROOT, DRYDOCK_DIR, 'regression.json'))) writeJson(path.join(ROOT, DRYDOCK_DIR, 'regression.json'), []);
    const gi = path.join(ROOT, '.gitignore');
    const want = ['.drydock/gates/', '.drydock/snapshots/', '.drydock/runs/', '.drydock/state.json', '.drydock/last-test.json', '.env', '.env.*', 'node_modules/'];
    let text = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
    const missing = want.filter((w) => !text.split(/\r?\n/).includes(w));
    if (missing.length) { text = text.replace(/\s*$/, '') + (text ? '\n' : '') + '# Drydock\n' + missing.join('\n') + '\n'; fs.writeFileSync(gi, text); }
    out({ ok: true, root: ROOT, config: cfg }, `Drydock initialized at ${ROOT} (tier ${cfg.tier}, level ${cfg.owner.level}).`);
  },

  config() {
    if (sub === 'set') {
      if (!arg3) fail('config set <dot.key> <value>');
      const cfg = readConfig(ROOT);
      const keys = arg3.split('.');
      let o = cfg;
      for (const k of keys.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }
      let v = arg4 === undefined ? '' : arg4;
      try { v = JSON.parse(v); } catch { /* keep string */ }
      o[keys[keys.length - 1]] = v;
      writeConfig(ROOT, cfg);
      out({ ok: true, key: arg3, value: v }, `set ${arg3} = ${JSON.stringify(v)}`);
      return;
    }
    out(readConfig(ROOT));
  },

  doctor() {
    const probes = {
      node: 'node --version', npm: 'npm --version', git: 'git --version', gh: 'gh --version', ghAuth: 'gh auth status',
      netlify: 'netlify --version', supabase: 'supabase --version', claude: 'claude --version',
    };
    const result = { os: process.platform, root: ROOT, isDrydockProject: isDrydockProject(ROOT), tools: {} };
    for (const [k, c] of Object.entries(probes)) {
      const r = run(c, { cwd: ROOT, timeoutMs: 15000 });
      result.tools[k] = { present: r.code === 0, detail: tail(r.out, 3, 300).trim() };
    }
    result.chrome = fs.existsSync('/Applications/Google Chrome.app') || fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe');
    const lines = Object.entries(result.tools).map(([k, v]) => `${v.present ? 'ok     ' : 'MISSING'} ${k}${v.present ? ': ' + v.detail.split('\n')[0] : ''}`);
    out(result, lines.join('\n'));
  },

  status() {
    const cfg = readConfig(ROOT);
    const st = readState(ROOT);
    const map = readMap(ROOT);
    const last = readJson(path.join(ROOT, DRYDOCK_DIR, 'last-test.json'), null);
    const segs = map ? map.segments : [];
    const green = segs.filter((s) => s.status === 'green').length;
    const summary = {
      project: cfg.project.name || path.basename(ROOT), tier: cfg.tier, level: cfg.owner.level,
      map: map ? { total: segs.length, green, mvpLine: map.mvpLine, finishedLine: map.finishedLine } : null,
      segments: segs.map((s) => ({ id: s.id, title: s.title, status: s.status, mode: s.mode, size: s.size, clauses: s.clauses.length })),
      active: st.activeSegment, gate: st.gate, blocks: st.blocks, lastTest: last,
      next: segs.find((s) => s.status !== 'green' && s.dependsOn.every((d) => (segs.find((x) => x.id === d) || {}).status === 'green')) || null,
    };
    const human = [
      `Project: ${summary.project}   Tier: ${summary.tier}   Owner level: ${summary.level}`,
      map ? `Map: ${green}/${segs.length} segments green.   MVP line: ${map.mvpLine || '(not set)'}   Finished line: ${map.finishedLine || '(not set)'}` : 'Map: none yet (run /drydock:plan)',
      ...segs.map((s) => `  ${s.status === 'green' ? '[x]' : s.status === 'building' ? '[~]' : s.status === 'blocked' ? '[!]' : '[ ]'} ${s.id} ${s.title}  (${s.mode}${s.size ? ', ' + s.size : ''}, ${s.clauses.length} exit clauses)`),
      `Active segment: ${st.activeSegment || 'none'}   Gate: ${st.gate}   Red checks in a row: ${st.blocks}`,
      last ? `Last test: ${last.code === 0 ? 'GREEN' : 'RED'} at ${last.at} (${last.cmd})` : 'Last test: never run',
      summary.next ? `Next buildable segment: ${summary.next.id} ${summary.next.title}` : (segs.length ? 'Nothing buildable: every open segment waits on something, or all green.' : ''),
    ].filter(Boolean).join('\n');
    out(summary, human);
  },

  map() {
    const m = readMap(ROOT);
    if (sub === 'list') {
      if (!m) fail('BUILD-MAP.md not found');
      out(m.segments, m.segments.map((s) => `${s.id}\t${s.status}\t${s.mode}\t${s.size}\t${s.title}\tclauses=${s.clauses.length}\tdepends=${s.dependsOn.join(',') || '-'}`).join('\n'));
      return;
    }
    if (sub === 'show') {
      if (!m) fail('BUILD-MAP.md not found');
      const s = m.segments.find((x) => x.id === String(arg3 || '').toUpperCase());
      if (!s) fail(`segment ${arg3} not found`);
      out(s, `${s.id} ${s.title}\nStatus: ${s.status}  Mode: ${s.mode}  Size: ${s.size}  Depends on: ${s.dependsOn.join(', ') || '-'}\nWhat you can do: ${s.whatYouCanDo}\nExit test:\n${s.clauses.map((c) => `  ${c.id}  ${c.text}`).join('\n')}\nHow we check it: ${s.howWeCheck}`);
      return;
    }
    if (sub === 'freeze') {
      if (!arg3) fail('map freeze <S#>');
      const frozen = freezeSegment(ROOT, arg3);
      const outFile = flags.out ? path.resolve(String(flags.out)) : path.join(runsDir(frozen.segment), 'frozen.json');
      writeJson(outFile, frozen);
      out({ ...frozen, frozenPath: outFile }, `Frozen ${frozen.segment} (${frozen.clauses.length} clauses) -> ${outFile}\n${frozen.clauses.map((c) => `  ${c.id}  ${c.text}`).join('\n')}`);
      return;
    }
    if (sub === 'grade') {
      if (!arg3) fail('map grade <S#> --graded <file>');
      const seg = arg3.toUpperCase();
      const frozenFile = flags.frozen ? path.resolve(String(flags.frozen)) : path.join(runsDir(seg), 'frozen.json');
      const frozen = readJson(frozenFile, null);
      if (!frozen) fail(`no frozen bar at ${frozenFile}. Run: drydock map freeze ${seg}`);
      const gradedFile = flags.graded ? path.resolve(String(flags.graded)) : path.join(runsDir(seg), 'graded.json');
      const graded = readJson(gradedFile, null);
      if (!graded) fail(`no graded file at ${gradedFile}`);
      const d = diffGraded(frozen, graded);
      const report = { segment: seg, ok: d.ok, allMet: d.allMet, problems: d.problems, frozenFile, gradedFile };
      writeJson(path.join(runsDir(seg), 'grade-report.json'), report);
      out(report, d.ok ? (d.allMet ? `GRADE OK: every clause of ${seg} echoed verbatim and marked met with evidence.` : `GRADE INTACT but NOT MET: some clauses of ${seg} are not met yet.`) : `GRADE BLOCKED for ${seg}:\n- ${d.problems.join('\n- ')}`);
      process.exit(d.ok ? (d.allMet ? 0 : 3) : 1);
    }
    if (sub === 'mark') {
      if (!arg3 || !arg4) fail('map mark <S#> <todo|building|green|blocked>');
      setCardField(ROOT, arg3.toUpperCase(), 'Status', arg4.toLowerCase());
      if (arg4.toLowerCase() === 'green') tickCard(ROOT, arg3.toUpperCase(), true);
      out({ ok: true, segment: arg3.toUpperCase(), status: arg4 }, `${arg3.toUpperCase()} -> ${arg4}`);
      return;
    }
    fail('map list | map show <S#> | map freeze <S#> | map grade <S#> --graded <file> | map mark <S#> <status>');
  },

  segment() {
    const st = readState(ROOT);
    if (sub === 'start') {
      if (!arg3) fail('segment start <S#>');
      const seg = arg3.toUpperCase();
      const frozen = freezeSegment(ROOT, seg);
      const frozenPath = path.join(runsDir(seg), 'frozen.json');
      writeJson(frozenPath, frozen);
      setCardField(ROOT, seg, 'Status', 'building');
      writeState(ROOT, { ...st, activeSegment: seg, gate: 'on', blocks: 0, startedAt: nowIso(), frozenPath });
      out({ ok: true, segment: seg, frozen, frozenPath }, `Segment ${seg} started. Gate ON. Frozen ${frozen.clauses.length} exit clauses -> ${frozenPath}\n${frozen.clauses.map((c) => `  ${c.id}  ${c.text}`).join('\n')}`);
      return;
    }
    if (sub === 'stop') { writeState(ROOT, { ...st, gate: 'off' }); out({ ok: true, gate: 'off' }, 'Gate OFF (waiting on the owner). The segment stays active.'); return; }
    if (sub === 'current') { out(st, st.activeSegment ? `Active: ${st.activeSegment}  gate=${st.gate}  blocks=${st.blocks}` : 'No active segment.'); return; }
    if (sub === 'done') {
      if (!arg3) fail('segment done <S#>');
      const seg = arg3.toUpperCase();
      const report = readJson(path.join(runsDir(seg), 'grade-report.json'), null);
      if (!flags.force && (!report || !report.allMet)) fail(`segment ${seg} has no passing grade report. Run: drydock map grade ${seg} --graded <file> (or --force if the owner accepted it as is).`, 1);
      setCardField(ROOT, seg, 'Status', 'green');
      tickCard(ROOT, seg, true);
      writeState(ROOT, { ...st, activeSegment: null, gate: 'off', blocks: 0, frozenPath: null });
      out({ ok: true, segment: seg }, `Segment ${seg} marked GREEN. Gate off. Remember: commit now, then update STATE.md.`);
      return;
    }
    fail('segment start <S#> | segment stop | segment done <S#> | segment current');
  },

  test() {
    const cfg = readConfig(ROOT);
    const c = cfg.commands.test;
    if (!c) fail('no test command configured. Set it: drydock config set commands.test "npm test"', 2);
    const r = run(c, { cwd: ROOT, timeoutMs: Number(flags.timeout || 240000) });
    const rec = { at: nowIso(), cmd: c, code: r.code, timedOut: r.timedOut, tail: tail(r.out, 60, 6000) };
    writeJson(path.join(ROOT, DRYDOCK_DIR, 'last-test.json'), rec);
    console.log(rec.tail);
    console.log(`\n[drydock test] ${c} -> exit ${r.code}${r.timedOut ? ' (timed out)' : ''} ${r.code === 0 ? 'GREEN' : 'RED'}`);
    process.exit(r.code === 0 ? 0 : 1);
  },

  regression() {
    const regFile = path.join(ROOT, DRYDOCK_DIR, 'regression.json');
    const reg = readJson(regFile, []);
    if (sub === 'add') {
      if (!arg3 || !arg4 || !pos[4]) fail('regression add <S#> <label> <cmd>');
      reg.push({ segment: arg3.toUpperCase(), label: arg4, cmd: pos.slice(4).join(' '), addedAt: nowIso() });
      writeJson(regFile, reg);
      out({ ok: true, entries: reg.length }, `added regression entry for ${arg3.toUpperCase()}: ${arg4}`);
      return;
    }
    if (sub === 'list') { out(reg, reg.map((e) => `${e.segment}\t${e.label}\t${e.cmd}`).join('\n') || '(no entries)'); return; }
    const cfg = readConfig(ROOT);
    const entries = [...(cfg.commands.test ? [{ segment: '*', label: 'project test command', cmd: cfg.commands.test }] : []), ...reg];
    if (!entries.length) { out({ ok: true, ran: 0 }, 'Nothing to run: no test command and no regression entries.'); return; }
    const results = [];
    for (const e of entries) {
      const r = run(e.cmd, { cwd: ROOT, timeoutMs: 240000 });
      results.push({ ...e, code: r.code, pass: r.code === 0, tail: tail(r.out, 25, 2500) });
    }
    const failed = results.filter((x) => !x.pass);
    writeJson(path.join(ROOT, DRYDOCK_DIR, 'last-regression.json'), { at: nowIso(), results });
    const human = results.map((x) => `${x.pass ? 'PASS' : 'FAIL'}  ${x.segment}  ${x.label}  (${x.cmd})${x.pass ? '' : '\n' + x.tail}`).join('\n');
    out({ ok: failed.length === 0, ran: results.length, failed: failed.length, results }, `${human}\n\n[drydock regression] ${results.length - failed.length}/${results.length} passed`);
    process.exit(failed.length ? 1 : 0);
  },

  gate() {
    const dir = path.join(ROOT, DRYDOCK_DIR, 'gates');
    if (sub === 'open') {
      const kind = String(arg3 || '').toLowerCase();
      if (!['push', 'deploy'].includes(kind)) fail('gate open <push|deploy>');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, kind), JSON.stringify({ openedAt: nowIso(), by: 'owner go recorded by the skill' }));
      out({ ok: true, kind }, `Gate OPEN for one ${kind} within ${readConfig(ROOT).limits.gateTokenMinutes} minutes. It closes itself after one use.`);
      return;
    }
    if (sub === 'release') { const st = readState(ROOT); writeState(ROOT, { ...st, gate: 'released' }); out({ ok: true }, 'Stop-gate released: the next completion claim will not be held. Tell the owner plainly that the exit test is not met.'); return; }
    if (sub === 'status' || !sub) {
      const st = readState(ROOT);
      const tokens = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      out({ stopGate: st.gate, blocks: st.blocks, openTokens: tokens }, `Stop-gate: ${st.gate} (red checks in a row: ${st.blocks}). Open publish tokens: ${tokens.join(', ') || 'none'}`);
      return;
    }
    fail('gate open <push|deploy> | gate release | gate status');
  },

  snapshot() {
    const st = readState(ROOT);
    const last = readJson(path.join(ROOT, DRYDOCK_DIR, 'last-test.json'), null);
    const map = readMap(ROOT);
    const git = (c) => tail(run(c, { cwd: ROOT, timeoutMs: 10000 }).out, 40, 3000).trim();
    const state = fs.existsSync(path.join(ROOT, 'STATE.md')) ? fs.readFileSync(path.join(ROOT, 'STATE.md'), 'utf8').split(/\r?\n/).slice(0, 60).join('\n') : '(no STATE.md)';
    const text = `# Drydock snapshot ${nowIso()}

Active segment: ${st.activeSegment || 'none'}  gate=${st.gate}  red checks in a row=${st.blocks}
Last test: ${last ? `${last.code === 0 ? 'GREEN' : 'RED'} at ${last.at} (${last.cmd})` : 'never'}
Map: ${map ? map.segments.map((s) => `${s.id}:${s.status}`).join(' ') : 'none'}

## git status --short
${git('git status --short') || '(clean or not a repo)'}

## git log -8 --oneline
${git('git log -8 --oneline') || '(no commits)'}

## STATE.md (first 60 lines)
${state}
`;
    const file = path.join(ROOT, DRYDOCK_DIR, 'snapshots', `${stamp()}.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    out({ ok: true, file }, `snapshot -> ${file}`);
  },

  'handoff-path'() {
    const cfg = readConfig(ROOT);
    const name = (cfg.project.name || path.basename(ROOT)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = String(sub || 'session').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const file = path.join(ROOT, 'docs', 'handoffs', `${today()}-${name}-${slug}.md`);
    out({ file }, file);
  },
};

if (!cmd || cmd === 'help' || cmd === '--help') { commands.help(); process.exit(0); }
if (!commands[cmd]) fail(`unknown command "${cmd}". Run: drydock help`);
try { commands[cmd](); } catch (e) { fail(e && e.message ? e.message : String(e), 2); }
