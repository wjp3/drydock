// Drydock crew. The build loop with every check done by an independent seat and pass/fail decided by
// deterministic gates. Cadence: Pre-flight -> Recon -> Build+Prove -> Verify -> Report -> Acceptance.
// Exists to stop: false "done" at scale. Each seat below names the failure it closes. Retire a seat when
// ten runs show it never changed an outcome; keep the deterministic gates.
//
// args = { brief: {...} }  (see skills/crew/SKILL.md for the brief's fields; every flag explicit)
export const meta = {
  name: 'crew-run',
  description: 'Drydock crew: freeze the exit test, 4 blind scouts, builder vs independent scorer and red team in bounded rounds, 4 adjudicators, a synthesizer, then a relay auditor, a cold reader, and a live walker. Dead seats are recorded, never dropped.',
  whenToUse: 'A CREW-mode segment on the full tier: logins, other people\'s data, money, or a rule that must never fail.',
  phases: [
    { title: 'Pre-flight', detail: 'freeze the exit test from BUILD-MAP.md; a failed freeze halts the job' },
    { title: 'Recon', detail: '4 scouts in parallel (fixes blind / safety design / domain rules / blast radius); a validator second-sources the domain rules when they are used' },
    { title: 'Build + prove', detail: 'bounded rounds: builder -> (independent scorer || red team); the scorer ends each round with the echo-grade of the frozen bar' },
    { title: 'Verify', detail: 'vision + checker (walks screens, runs regression) + correctness + honesty, in parallel' },
    { title: 'Report', detail: 'synthesizer writes OWNER-READ.md and RESULT.md and registers the new checks' },
    { title: 'Acceptance', detail: 'relay auditor || cold reader || live walker (when the segment ships a walkable surface)' },
  ],
}

const A = (args && typeof args === 'object') ? args : {}
const B = A.brief
if (!B || typeof B !== 'object') throw new Error('args.brief is required. See skills/crew/SKILL.md for its shape.')
for (const k of ['segment', 'repo', 'base', 'branch', 'testCmd', 'runsDir', 'drydockCli', 'flags']) if (B[k] === undefined || B[k] === null || B[k] === '') throw new Error(`brief.${k} is required`)
for (const f of ['untrustedInput', 'guardAuthoredOrEdited', 'touchesEarlierSegments', 'walkable']) if (typeof B.flags[f] !== 'boolean') throw new Error(`brief.flags.${f} must be true or false. Silence is never a waiver.`)

const SEG = String(B.segment).toUpperCase()
const REPO = B.repo
const OUT = B.runsDir
const CLI = `node "${B.drydockCli}"`
const MAX_ROUNDS = Math.max(1, Math.min(4, Number(B.maxRounds || 3)))
const LANES = { build: (B.lanes && B.lanes.build) || 'opus', check: (B.lanes && B.lanes.check) || 'fable', small: (B.lanes && B.lanes.small) || 'sonnet' }
const BUILD = { model: LANES.build }
const CHECK_HIGH = { model: LANES.check, effort: 'high' }
const SMALL = { model: LANES.small }
const SMALL_HIGH = { model: LANES.small, effort: 'high' }
const NEED_RED_TEAM = !!B.flags.untrustedInput || !!B.flags.guardAuthoredOrEdited
const NEED_RULES_VALIDATOR = !!B.flags.domainRulesUsed
const REGRESSION_HARD = !!B.flags.touchesEarlierSegments
const NEED_LIVE_WALK = !!B.flags.walkable && !!(B.appUrl && String(B.appUrl).trim()) && Array.isArray(B.walkTasks) && B.walkTasks.length > 0

const RULES = `CARDINAL RULES (bind every seat):
- Work in ${REPO}. Branch ${B.branch} FROM ${B.base}. Commit only this segment's files. NO push, NO deploy, NO publishing, NO sends. Never type or commit a secret.
- Never write to a remote data store that holds real people's data. ${B.dbTarget ? `The only database you may touch is ${B.dbTarget}.` : 'If the stack has a database, use the local or staging one named in the project config; if none is named, build with a local or in-memory store and say so.'}
- SAFE FALLBACK (the anti-grind floor): ${B.safeFallback || 'if the change cannot be made robust in this run, gate the feature off rather than ship it half-working; a degraded-but-safe outcome is valid, a wrong silent outcome is not.'}
- HONESTY BAR: never call a guard safe without independent attacks that failed against it; never call a clause met without a receipt; say "unproven" and name the missing check rather than guess. A probe that passes by construction is the failure this crew hunts.
- Plain English in everything the owner will read. No em dashes.`

const CONTEXT_BLIND = `DRYDOCK CREW JOB: segment ${SEG}${B.title ? ` (${B.title})` : ''}. Repo root: ${REPO}. VISION.md is the owner's intent; BUILD-MAP.md is the contract; DECIDED.md is settled.
Test command: ${B.testCmd}${B.typecheckCmd ? `. Typecheck: ${B.typecheckCmd}` : ''}${B.devCmd ? `. Run locally: ${B.devCmd}` : ''}.
${RULES}`
const CONTEXT = `${CONTEXT_BLIND}

THE HANDED FINDINGS (what this job builds, from the card):
${B.findings || '(none handed; derive from the frozen bar)'}`

const CHECKER_CHARTER = `CHECKER CHARTER (apply every clause, report which you executed):
 1. WALK EVERY SCREEN THE CHANGE REACHES, no sampling within that set: start the app and drive a real browser if browser tools are available; screenshot each screen to ${OUT}/walk/. If you cannot start the app or a browser, mark the walk NOT DONE (honest); never fake it.
 2. BLAST RADIUS BEFORE TRUST: grep the importers and callers of every changed function; confirm no caller silently broke.
 3. PROVE IT IS REAL: name the mechanism that makes each piece of evidence reflect the real system, not a mock or a tautology.
 4. HONEST FALLBACK: any leg you cannot run is NOT DONE, never described as done.`

const RED_TEAM_CHARTER = `RED TEAM CHARTER. Threat model: anyone who can type into the app's inputs, call its URLs directly, sit at a second device, or (if any user text reaches a model) hide instructions in that text.
INDEPENDENCE: you run in parallel with the scorer and never see its verdict; you are not the safety-design scout and not the builder; you run on a different model lane than the builder. Derive what a guard does from the DIFF and the CODE; the builder's narrative is withheld from you on purpose.
ATTACK every round: hostile inputs (empty, huge, unicode, tags, SQL fragments, impossible dates, duplicates); direct requests signed out, as another user, with other users' ids, twice fast, with fields removed or added; state after refresh, back, two tabs, expired session; prompt injection where text reaches a model; secrets or leaks in the client bundle, logs, or error messages.
BOTH DIRECTIONS on every guard authored or edited this round: the hole it closed AND the genuine case next to it that must still work. A guard green only against the attack that motivated it is NOT reviewed. Pin both directions into permanent tests and name the file.
Attack only the local or preview target. Never a live site with real people's data.
VERDICT: BREACH if any attack bypassed a rule or any good case was over-refused; else CLEAN. Report every attack body verbatim.`

const RULES_VALIDATOR_CHARTER = `DOMAIN-RULES VALIDATOR CHARTER. You second-source the "what correct behavior is" rules the domain-rules scout wrote, from VISION.md, the card, and DECIDED.md, and you run on a different model lane than their author. Do not treat the scout's rules as presumed correct; this seat exists because a single-authored rule set once graded a whole build wrongly. Rule on every entry; correct the file in place; VETO if any rule would make the product do something the vision says it must never do. A VETO halts the job before any build.`

const RELAY_AUDITOR_CHARTER = `RELAY AUDITOR CHARTER (the terminal gate). Your prompt deliberately omits the synthesizer's own summary of itself. Read OWNER-READ.md from disk, then the PRIMARY receipts (round JSON, adjudicator verdicts, files on disk). For EVERY load-bearing claim in OWNER-READ.md, trace it to a receipt at MATCHING strength: an n=1 stays n=1, a CONCERN stays a CONCERN, "proven" requires the independent scorer's re-derivation, "safe" requires the red team's CLEAN. FLAG over-claims, dropped BLOCKs, causal stories with no receipt, silently narrowed scope. TYPE THE OUTCOME: a not-met bar or an exhausted loop is HALT, never "done with caveats". Emit relayLicense: the exact claims the orchestrator may relay to the owner, each with its receipt and strength. Anything outside the license is unlicensed.`

const COLD_READER_CHARTER = `COLD READER CHARTER. You are handed ONLY: the frozen exit-test clauses, VISION.md (read it yourself), and the delivered diff. You are deliberately denied every scout brief, round receipt, verdict, and narrative, and you must not go fishing for them. Judge COLD: does the delivered thing do what the clauses and the vision ask, on its own terms? BLOCK with the exact gap or ACCEPT.`

const LIVE_WALK_CHARTER = `LIVE WALKER CHARTER. You judge the RUNNING product from the outside, as the person who has to use it. You owe nothing to the crew's narrative or its self-written probes. Drive a real browser: prefer the Playwright MCP tools (load with ToolSearch: select:mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_type,mcp__playwright__browser_take_screenshot); if no browser tool exists, return BLOCK with a gap saying the walk could not run, never a pass. Perform each task end to end, clicking and reading. For each: works | broken | looks-wrong, with proof (screenshot path or exact text). The bar is not "did it render" but "would the person this is for get the task done without confusion". Never send, publish, or deploy.`

// ---------- schemas ----------
const preSchema = { type: 'object', additionalProperties: false, required: ['freezeOk', 'freezeExit'], properties: { freezeOk: { type: 'boolean' }, freezeExit: { type: 'integer' }, frozenBar: { type: 'object', additionalProperties: true }, frozenPath: { type: 'string' }, blocker: { type: 'string' } } }
const scoutSchema = { type: 'object', additionalProperties: false, required: ['area', 'buildDirectives'], properties: { area: { type: 'string' }, findings: { type: 'array', items: { type: 'string' } }, blindRiskList: { type: 'array', items: { type: 'string' } },
  buildDirectives: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['file', 'what'], properties: { file: { type: 'string' }, lines: { type: 'string' }, what: { type: 'string' } } } },
  rulesPath: { type: 'string' }, routesToWalk: { type: 'array', items: { type: 'string' } }, checksToAdd: { type: 'array', items: { type: 'string' } }, risks: { type: 'array', items: { type: 'string' } } } }
const rulesValSchema = { type: 'object', additionalProperties: false, required: ['verdict', 'rulesSound', 'changes'], properties: { verdict: { type: 'string', enum: ['PASS', 'VETO'] }, vetoReason: { type: 'string' }, rulesSound: { type: 'boolean' }, changes: { type: 'array', items: { type: 'string' } }, note: { type: 'string' } } }
const roundSchema = { type: 'object', additionalProperties: false, required: ['round', 'fixesApplied', 'testsGreen', 'exitTestMet', 'evidence'], properties: { round: { type: 'integer' }, filesChanged: { type: 'array', items: { type: 'string' } }, fixesApplied: { type: 'array', items: { type: 'string' } }, testsGreen: { type: 'boolean' }, commandResults: { type: 'array', items: { type: 'string' } }, safeFallbackTaken: { type: 'boolean' }, exitTestMet: { type: 'boolean' }, evidence: { type: 'string' }, nextIfNotMet: { type: 'string' } } }
const scoreSchema = { type: 'object', additionalProperties: false, required: ['round', 'exitTestMet', 'gradeExit', 'gradedPath', 'falseClaims', 'evidenceChecked', 'nextFixPlan'], properties: { round: { type: 'integer' }, exitTestMet: { type: 'boolean' }, gradeExit: { type: 'integer' }, gradedPath: { type: 'string' },
  falseClaims: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['claim', 'why'], properties: { claim: { type: 'string' }, why: { type: 'string' } } } },
  discriminationProven: { type: 'boolean' }, ngtDiff: { type: 'array', items: { type: 'string' } }, evidenceChecked: { type: 'string' }, nextFixPlan: { type: 'string' } } }
const redSchema = { type: 'object', additionalProperties: false, required: ['round', 'verdict', 'bothDirectionsAttacked', 'casesThatBypassed', 'casesPinned'], properties: { round: { type: 'integer' }, verdict: { type: 'string', enum: ['CLEAN', 'BREACH'] },
  bothDirectionsAttacked: { type: 'object', additionalProperties: false, required: ['closedHole', 'goodCaseStillWorks'], properties: { closedHole: { type: 'boolean' }, goodCaseStillWorks: { type: 'boolean' } } },
  casesThatBypassed: { type: 'array', items: { type: 'string' } }, casesPinned: { type: 'array', items: { type: 'string' } }, guardsInScope: { type: 'array', items: { type: 'string' } }, testFile: { type: 'string' }, notes: { type: 'string' } } }
const verdictSchema = { type: 'object', additionalProperties: false, required: ['seat', 'verdict', 'findings'], properties: { seat: { type: 'string' }, verdict: { type: 'string', enum: ['PASS', 'CONCERN', 'BLOCK'] },
  findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity', 'claim', 'evidence'], properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'note'] }, claim: { type: 'string' }, evidence: { type: 'string' }, fileLine: { type: 'string' } } } },
  ownerCalls: { type: 'array', items: { type: 'string' } }, walkProof: { type: 'string' }, regressionExit: { type: 'integer' } } }
const synthSchema = { type: 'object', additionalProperties: false, required: ['exitTestMet', 'filesWritten', 'ownerRead', 'checksRegistered'], properties: { exitTestMet: { type: 'boolean' }, verdictRollup: { type: 'string' },
  rankedRemaining: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity', 'symptom'], properties: { severity: { type: 'string' }, symptom: { type: 'string' }, evidence: { type: 'string' } } } },
  filesWritten: { type: 'array', items: { type: 'string' } }, checksRegistered: { type: 'boolean' }, ownerRead: { type: 'string' }, ownerCalls: { type: 'array', items: { type: 'string' } } } }
const auditSchema = { type: 'object', additionalProperties: false, required: ['verdict', 'overclaims', 'relayLicense'], properties: { verdict: { type: 'string', enum: ['PASS', 'HALT', 'BLOCK'] },
  overclaims: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['claim', 'why'], properties: { claim: { type: 'string' }, receipt: { type: 'string' }, why: { type: 'string' } } } },
  relayLicense: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['claim', 'receipt', 'strength'], properties: { claim: { type: 'string' }, receipt: { type: 'string' }, strength: { type: 'string' } } } }, notes: { type: 'string' } } }
const coldSchema = { type: 'object', additionalProperties: false, required: ['verdict', 'matchesAsk', 'gaps'], properties: { verdict: { type: 'string', enum: ['ACCEPT', 'BLOCK'] }, matchesAsk: { type: 'boolean' }, gaps: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } } }
const liveWalkSchema = { type: 'object', additionalProperties: false, required: ['verdict', 'walkedTasks', 'gaps'], properties: { verdict: { type: 'string', enum: ['ACCEPT', 'CONCERN', 'BLOCK'] },
  walkedTasks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['task', 'result', 'proof'], properties: { task: { type: 'string' }, result: { type: 'string', enum: ['works', 'broken', 'looks-wrong'] }, proof: { type: 'string' } } } },
  gaps: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity', 'whatAPersonExpects', 'whatTheAppDid'], properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'note'] }, whatAPersonExpects: { type: 'string' }, whatTheAppDid: { type: 'string' }, screen: { type: 'string' } } } }, notes: { type: 'string' } } }

const GP = { agentType: 'general-purpose' }
const missingSeats = []

// ═══ Phase 1: PRE-FLIGHT ═══
phase('Pre-flight')
log(`Crew ${SEG}: red team=${NEED_RED_TEAM} rules validator=${NEED_RULES_VALIDATOR} regression hard=${REGRESSION_HARD} live walk=${NEED_LIVE_WALK}; lanes build=${LANES.build} check=${LANES.check} small=${LANES.small}`)
const pre = await agent(`${CONTEXT}

You are the PRE-FLIGHT seat (mechanical). Via Bash from ${REPO}, in order:
1. mkdir -p "${OUT}"
2. FREEZE THE BAR: ${CLI} map freeze ${SEG} --root "${REPO}" --out "${OUT}/frozen.json" --json
   Record the exit code as freezeExit. On exit 0, read the JSON back and return it VERBATIM as frozenBar with freezeOk=true and frozenPath. On any other exit, freezeOk=false with the exact stderr as blocker. Do NOT paraphrase the card's exit test from memory as a substitute: a job with no frozen bar does not run.
Return honestly; you build nothing and judge nothing.`, { label: 'preflight:freeze-bar', phase: 'Pre-flight', schema: preSchema, ...GP, ...SMALL })

if (!pre || !pre.freezeOk || !pre.frozenBar) {
  if (!pre) missingSeats.push('preflight:freeze-bar')
  return { segment: SEG, accepted: false, buildPassed: false, halted: 'bar-freeze-failed', pre, missingSeats, note: 'The exit test could not be frozen from BUILD-MAP.md. No build ran. Fix the card (it needs indented "- [ ]" clauses under **Exit test:**) and run again.' }
}
const FROZEN_BAR = JSON.stringify(pre.frozenBar)
const BAR_BLOCK = `\nTHE FROZEN BAR (the ONLY bar this job is graded against; never re-type, paraphrase, or soften it; graders echo clause text VERBATIM):\n${FROZEN_BAR}`
const CTX = `${CONTEXT}${BAR_BLOCK}`
const CTX_BLIND = `${CONTEXT_BLIND}${BAR_BLOCK}`
const clausesText = (pre.frozenBar.clauses || []).map((c) => `- [${c.id}] ${c.text}`).join('\n')

// ═══ Phase 2: RECON ═══
phase('Recon')
const SCOUT_LABELS = ['scout:fixes', 'scout:safety-design', 'scout:domain-rules', 'scout:blast-radius']
const scouts = await parallel([
  () => agent(`${CTX_BLIND}

SCOUT: FIXES (read-only; design, don't build). You have deliberately NOT been handed this job's findings (you generate first; the crew diffs after). From the frozen bar and the repo at HEAD:
1. blindRiskList: everything you believe must change or could break for the bar to be met, file:line each.
2. buildDirectives: the exact minimal, local changes you would pin (file + lines + what).
3. risks: ways a change here silently regresses a neighbor.`, { label: 'scout:fixes', phase: 'Recon', schema: scoutSchema, ...GP, ...SMALL }),
  () => agent(`${CTX}

SCOUT: SAFETY DESIGN (read-only). For every rule or guard this job authors or edits (permissions, validations, filters): where it enforces (the one chokepoint no caller can route around), how "refuse" is decided (fail toward the harmless direction; justify the asymmetry), how any model-based judgment stays a SECOND gate behind a deterministic check, and the undo or visibility surface (a refused action must be visible and reversible). Specify the test that pins the guard BOTH directions and where it lives. buildDirectives = file + lines + what.`, { label: 'scout:safety-design', phase: 'Recon', schema: scoutSchema, ...GP, ...SMALL }),
  () => agent(`${CTX}

SCOUT: DOMAIN RULES (read-only). From VISION.md, DECIDED.md, and the card, write the rules of correct behavior this segment must obey: what each clause means in the user's world, every must-never that touches it, and what a wrong default would cost. ${NEED_RULES_VALIDATOR ? `WRITE them to "${OUT}/domain-rules.md" (mkdir -p) and return rulesPath; a validator on another model lane will second-source every entry.` : 'Return them as findings, file:line where they come from.'}`, { label: 'scout:domain-rules', phase: 'Recon', schema: scoutSchema, ...GP, ...SMALL }),
  () => agent(`${CTX}

SCOUT: BLAST RADIUS (read-only) under the checker charter's clause 2:
${CHECKER_CHARTER}
For each file this job will touch: importers and callers (grep), the screens or routes that render it, the tests that cover it, 3 to 4 hops out. routesToWalk: the screens a person would click through to see this segment and its neighbors. checksToAdd: one check per frozen clause, before any code. buildDirectives: the files to regression-check.`, { label: 'scout:blast-radius', phase: 'Recon', schema: scoutSchema, ...GP, ...SMALL }),
])
scouts.forEach((s, i) => { if (!s) missingSeats.push(SCOUT_LABELS[i]) })

let rulesValidation = null
if (NEED_RULES_VALIDATOR) {
  const rulesPath = (scouts[2] && scouts[2].rulesPath) ? scouts[2].rulesPath : `${OUT}/domain-rules.md`
  rulesValidation = await agent(`${CTX}\n\n${RULES_VALIDATOR_CHARTER}\n\nTHE RULES UNDER VALIDATION: ${rulesPath} (treat as UNVERIFIED). Rule on every entry; correct in place; PASS or VETO.`, { label: 'domain-rules-validator', phase: 'Recon', schema: rulesValSchema, ...GP, ...BUILD })
  if (!rulesValidation) missingSeats.push('domain-rules-validator')
  if (!rulesValidation || rulesValidation.verdict === 'VETO') {
    return { segment: SEG, accepted: false, buildPassed: false, halted: rulesValidation ? 'domain-rules-veto' : 'domain-rules-validator-dead', pre, scouts, rulesValidation, missingSeats,
      note: rulesValidation ? `VETO from the domain-rules validator: ${rulesValidation.vetoReason || '(see result)'}. No build ran.` : 'The domain-rules validator returned nothing. A missing validator is a BLOCK, never a pass. No build ran.' }
  }
}
const scoutBrief = `SCOUTS (fixes was blind to the handed findings):\n${SCOUT_LABELS.map((l, i) => `### ${l}\n${JSON.stringify(scouts[i], null, 2)}`).join('\n\n')}${rulesValidation ? `\n### domain-rules-validator (the rules file on disk is now the validated reference)\n${JSON.stringify(rulesValidation, null, 2)}` : ''}`

// ═══ Phase 3: BUILD + PROVE ═══
phase('Build + prove')
const rounds = []
let lastRound = null, lastScore = null, lastRed = null, buildPassed = false
for (let n = 1; n <= MAX_ROUNDS; n++) {
  const prior = lastScore ? `\nPRIOR ROUND ${n - 1} SCORER RULING (address its falseClaims and nextFixPlan FIRST):\n${JSON.stringify(lastScore, null, 2)}${lastRed ? `\nPRIOR ROUND RED-TEAM RULING (every bypass must now be refused, every over-refusal must now work):\n${JSON.stringify(lastRed, null, 2)}` : ''}` : ''
  const r = await agent(`${CTX}\n\n${scoutBrief}\n${prior}

You are the BUILDER, ROUND ${n} of up to ${MAX_ROUNDS}.
${n === 1 ? `git checkout -b ${B.branch} ${B.base} (from ${REPO}).` : `Continue on ${B.branch}.`} TESTS FIRST: for each frozen clause, write the check the blast-radius scout proposed (or the cheapest honest one) and run it; it must fail before you build. Then apply the scouts' buildDirectives (do not re-discover). Build in small steps; commit at every green with a message starting "${SEG}:". Run the test command ${B.testCmd}${B.typecheckCmd ? ` and the typecheck ${B.typecheckCmd}` : ''} green and record each in commandResults. Write the round receipt to "${OUT}/round-${n}/RECEIPT.md". NEVER push, deploy, or publish.
If after honest effort the change cannot be made robust this round, take the SAFE FALLBACK (safeFallbackTaken=true).
exitTestMet = TRUE only if EVERY clause of the frozen bar is met with evidence you can point to. Do not self-grade generously: the independent scorer re-derives everything and the echo-grade is deterministic.`, { label: `builder:r${n}`, phase: 'Build + prove', schema: roundSchema, ...GP, ...BUILD })
  if (!r) { missingSeats.push(`builder:r${n}`); rounds.push({ round: n, builder: null }); break }
  lastRound = r

  const checks = await parallel([
    () => agent(`${CTX}

You are the INDEPENDENT SCORER, ROUND ${n}. You run on a different model lane than the builder and share none of its context. Builder claims:
${JSON.stringify(r, null, 2)}
RE-DERIVE, do not trust:
1. Run the test command yourself from ${B.branch} in ${REPO}; read git diff ${B.base}...${B.branch}; check every claim against what the code and output show. falseClaims = every claim the code or output contradicts.
2. DISCRIMINATION: prove at least one new test distinguishes fixed from broken: run it at ${B.base} in a throwaway worktree (git worktree add) and it must FAIL there. A test green on both branches proves nothing. discriminationProven accordingly.
3. NGT DIFF: compare scout:fixes' blindRiskList with the handed findings (both in your context); anything one caught and the other missed is a finding in ngtDiff.
4. GRADE THE BAR (your LAST action; deterministic; outranks your narrative): write "${OUT}/graded-round-${n}.json" as {"segment":"${SEG}","clauseVerdicts":[{"clauseId","echoedText","met","evidence"}]} where echoedText copies each frozen clause's text VERBATIM. Then run:
   ${CLI} map grade ${SEG} --root "${REPO}" --frozen "${OUT}/frozen.json" --graded "${OUT}/graded-round-${n}.json"
   Record the exit code as gradeExit. Exit 0 = intact and met. Exit 3 = intact, not met. Exit 1 = dropped, softened, or widened. If gradeExit is not 0, exitTestMet MUST be false regardless of your own reading.
nextFixPlan = the exact plan for the next round if not met.`, { label: `scorer:r${n}`, phase: 'Build + prove', schema: scoreSchema, ...GP, ...CHECK_HIGH }),
    ...(NEED_RED_TEAM ? [() => agent(`${CTX}\n\n${RED_TEAM_CHARTER}\n\nROUND ${n}. The builder changed these files on ${B.branch} (the LIST only; derive what the changes do from the diff yourself): ${JSON.stringify(r.filesChanged || [])}\nguardAuthoredOrEdited=${B.flags.guardAuthoredOrEdited}: if true, both directions must be genuinely attacked, not asserted. Write attack bodies and results to "${OUT}/red-team-round-${n}/CASES.md". Pin the cases as tests in a new file and name it in testFile. Verdict CLEAN only if every attack held and every good case still works.`, { label: `red-team:r${n}`, phase: 'Build + prove', schema: redSchema, ...GP, ...CHECK_HIGH })] : []),
  ])
  const s = checks[0] || null
  const rt = NEED_RED_TEAM ? (checks[1] || null) : undefined
  if (!s) missingSeats.push(`scorer:r${n}`)
  if (NEED_RED_TEAM && !rt) missingSeats.push(`red-team:r${n}`)
  lastScore = s; lastRed = rt || null
  rounds.push({ round: n, builder: r, scorer: s, redTeam: rt === undefined ? 'not-required' : rt })
  const scorerPass = !!(s && s.exitTestMet && s.gradeExit === 0)
  const redPass = !NEED_RED_TEAM ? true : !!(rt && rt.verdict === 'CLEAN' && (!B.flags.guardAuthoredOrEdited || (rt.bothDirectionsAttacked && rt.bothDirectionsAttacked.closedHole && rt.bothDirectionsAttacked.goodCaseStillWorks)))
  if (scorerPass && redPass) { buildPassed = true; break }
}
// The final graded file the orchestrator grades again: copy the last round's into graded.json
const lastGraded = lastScore && lastScore.gradedPath ? lastScore.gradedPath : `${OUT}/graded-round-${rounds.length}.json`

// ═══ Phase 4: VERIFY ═══
phase('Verify')
const finalCtx = `FINAL BUILD: ${JSON.stringify(lastRound, null, 2)}\n\nFINAL SCORE: ${JSON.stringify(lastScore, null, 2)}\n\nFINAL RED TEAM: ${JSON.stringify(lastRed, null, 2)}\n\nbuildPassed=${buildPassed} after ${rounds.length} round(s).`
const VERIFY_LABELS = ['adj:vision', 'adj:checker', 'adj:correctness', 'adj:honesty']
const verdictsRaw = await parallel([
  () => agent(`${CTX}\n\nYou are the VISION seat (the owner's lens). ${finalCtx}\nRead VISION.md and git diff ${B.base}...${B.branch} in ${REPO}. Does this genuinely meet the frozen bar in the spirit of the vision? Hunt over-claims and anything the vision says must never happen. Verdict + file:line evidence + ownerCalls.`, { label: 'adj:vision', phase: 'Verify', schema: verdictSchema, ...GP, ...BUILD }),
  () => agent(`${CTX}\n\nYou are the CHECKER. ${CHECKER_CHARTER}\n${finalCtx}\nWalk every route in scout:blast-radius' routesToWalk (screenshots to "${OUT}/walk/"); prove nothing broke. PLUS run the regression battery and record its exit code as regressionExit:\n   ${CLI} regression --root "${REPO}"\n${REGRESSION_HARD ? 'touchesEarlierSegments=true: a non-zero exit is a BLOCKER finding.' : 'A non-zero exit is at least a major finding.'} Verdict + walkProof + regressionExit.`, { label: 'adj:checker', phase: 'Verify', schema: verdictSchema, ...GP, ...SMALL }),
  () => agent(`${CTX}\n\nYou are CORRECTNESS. ${finalCtx}\nRead git diff ${B.base}...${B.branch}. Is each change correct AND minimal? Does every guard AVOID the opposite error (over-refusing the genuine case)? Do not use a browser. Verdict + file:line findings.`, { label: 'adj:correctness', phase: 'Verify', schema: verdictSchema, ...GP, ...SMALL_HIGH }),
  () => agent(`${CTX}\n\nYou are the HONESTY seat (skeptic). ${finalCtx}\nSingle duty: is this run REAL and are its receipts TRUSTWORTHY? Anti-tautology sweep: any test or receipt that passes by construction? Any claim resting on one run presented as general? Is every "proven" backed by the INDEPENDENT scorer's own re-derivation (never the builder's self-grade)${NEED_RED_TEAM ? ', and every "safe" by the red team\'s CLEAN' : ''}? Default CONCERN when a claim outruns evidence. No browser. Verdict + findings.`, { label: 'adj:honesty', phase: 'Verify', schema: verdictSchema, ...GP, ...SMALL_HIGH }),
])
const verdicts = []
verdictsRaw.forEach((v, i) => { if (v) verdicts.push(v); else missingSeats.push(VERIFY_LABELS[i]) })

// ═══ Phase 5: REPORT ═══
phase('Report')
const synth = await agent(`${CTX}

You are the SYNTHESIZER. Inputs:
ROUNDS: ${JSON.stringify(rounds)}
VERDICTS: ${JSON.stringify(verdicts)}
DEAD SEATS (must be stated in the owner read, never hidden): ${JSON.stringify(missingSeats)}
WRITE (mkdir -p "${OUT}"):
- "${OUT}/OWNER-READ.md": plain English for the owner: what was asked (the frozen clauses, plainly), what was PROVEN and by whom (the independent scorer's re-derivation${NEED_RED_TEAM ? ' and the red team\'s attacks' : ''}, never the builder's self-grade), what is NOT proven (say "unproven" and name the missing check), what is still open (ranked), what only the owner can decide. If the bar was not met, LEAD with that; no completion language.
- "${OUT}/RESULT.md": the technical receipt: the diff (file:line), every command and result, the echo-grade result per round, the discrimination test, the regression exit.
- REGISTER the new checks so later segments re-run them: for each new test file this job pinned, run ${CLI} regression add ${SEG} "<label>" "<command that runs that file>" --root "${REPO}". checksRegistered=true only if actually run.
exitTestMet must equal the deterministic outcome (scorer + echo-grade), not your narrative. Your OWNER-READ.md is audited next by a seat whose whole job is catching you.`, { label: 'synth', phase: 'Report', schema: synthSchema, ...GP, ...BUILD })
if (!synth) missingSeats.push('synth')

// ═══ Phase 6: ACCEPTANCE ═══
phase('Acceptance')
const acceptance = await parallel([
  () => agent(`${RULES}\n\n${RELAY_AUDITOR_CHARTER}\n\nTHE REPORT UNDER AUDIT: "${OUT}/OWNER-READ.md" (read it from disk).\nPRIMARY RECEIPTS:\nFROZEN BAR: ${FROZEN_BAR}\nROUNDS: ${JSON.stringify(rounds)}\nADJUDICATOR VERDICTS: ${JSON.stringify(verdicts)}\nDEAD SEATS: ${JSON.stringify(missingSeats)}\nbuildPassed=${buildPassed}. Round receipts live under "${OUT}/round-*/".`, { label: 'relay-auditor', phase: 'Acceptance', schema: auditSchema, ...GP, ...CHECK_HIGH }),
  () => agent(`READ-ONLY: read files and run read-only git commands only; write nothing; never push or deploy.\n\n${COLD_READER_CHARTER}\n\nTHE ASK (the frozen exit-test clauses, verbatim):\n${clausesText}\nTHE VISION: read ${REPO}/VISION.md yourself.\nTHE DELIVERED ARTIFACT: git diff ${B.base}...${B.branch} in ${REPO}${Array.isArray(B.deliverables) && B.deliverables.length ? `, plus: ${JSON.stringify(B.deliverables)}` : ''}.\nJudge cold.`, { label: 'cold-reader', phase: 'Acceptance', schema: coldSchema, ...GP, ...SMALL_HIGH }),
  ...(NEED_LIVE_WALK ? [() => agent(`READ-ONLY on server state: drive the UI, send/publish/deploy NOTHING.\n\n${LIVE_WALK_CHARTER}\n\nTHE SURFACE: ${B.appUrl}${B.devCmd ? ` (if it is a local URL and not running, start it with: ${B.devCmd} in ${REPO})` : ''}\nTHE PERSON'S REAL TASKS, in order:\n${(B.walkTasks || []).map((t, i) => `  ${i + 1}. ${t}`).join('\n')}\nScreenshots to "${OUT}/live-walk/".`, { label: 'live-walker', phase: 'Acceptance', schema: liveWalkSchema, ...GP, ...CHECK_HIGH })] : []),
])
const audit = acceptance[0] || null
const cold = acceptance[1] || null
const live = NEED_LIVE_WALK ? (acceptance[2] || null) : null
if (!audit) missingSeats.push('relay-auditor')
if (!cold) missingSeats.push('cold-reader')
if (NEED_LIVE_WALK && !live) missingSeats.push('live-walker')

const accepted = buildPassed && !!(audit && audit.verdict === 'PASS') && !!(cold && cold.verdict === 'ACCEPT') && (!NEED_LIVE_WALK || !!(live && live.verdict === 'ACCEPT')) && missingSeats.length === 0

const requestedLanes = [
  { label: 'preflight:freeze-bar', lane: LANES.small }, ...SCOUT_LABELS.map((l) => ({ label: l, lane: LANES.small })),
  ...(NEED_RULES_VALIDATOR ? [{ label: 'domain-rules-validator', lane: LANES.build }] : []),
  { label: 'builder', lane: LANES.build }, { label: 'scorer', lane: LANES.check }, ...(NEED_RED_TEAM ? [{ label: 'red-team', lane: LANES.check }] : []),
  { label: 'adj:vision', lane: LANES.build }, { label: 'adj:checker', lane: LANES.small }, { label: 'adj:correctness', lane: LANES.small }, { label: 'adj:honesty', lane: LANES.small },
  { label: 'synth', lane: LANES.build }, { label: 'relay-auditor', lane: LANES.check }, { label: 'cold-reader', lane: LANES.small }, ...(NEED_LIVE_WALK ? [{ label: 'live-walker', lane: LANES.check }] : []),
]

return {
  segment: SEG, branch: B.branch, accepted, buildPassed,
  halted: accepted ? null : (buildPassed ? 'acceptance-block' : 'exit-test-not-met'),
  pre, scouts, rulesValidation, rounds, verdicts, missingSeats, synth,
  acceptance: { audit, cold, live },
  relayLicense: audit ? audit.relayLicense : [],
  gradedPath: lastGraded, ownerReadPath: `${OUT}/OWNER-READ.md`, resultPath: `${OUT}/RESULT.md`,
  requestedLanes,
  postRun: {
    note: 'MANDATORY before relaying anything to the owner: missingSeats non-empty is a BLOCK; run the echo-grade again yourself; relay ONLY within relayLicense; lead with HALT if the bar was not met; say whether the requested model lanes could be honored on this plan.',
    grade: `${CLI} map grade ${SEG} --root "${REPO}" --frozen "${OUT}/frozen.json" --graded "${lastGraded}"`,
  },
}
