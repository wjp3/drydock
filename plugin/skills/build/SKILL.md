---
name: "build"
description: "Builds one segment of the BUILD-MAP: freezes its exit test, writes failing tests first, builds until green, runs a fresh-context check and a red team, walks the running app, files the proof, commits, and stops at the exit test with evidence. Use when the owner says \"build S3\", \"next\", or \"start the next segment\"."
---

Read `${CLAUDE_PLUGIN_ROOT}/reference/voice.md`, `method.md`, `exit-tests.md`, and `tiers.md`. Read `.drydock/config.json`, `STATE.md`, `DECIDED.md`, and the card. The segment is the argument (`S3`), or "next" (the first card whose dependencies are all green: `node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" status --json` → `next`).

Alias used below: `DRYDOCK` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs"`.

## Before starting
- **Preconditions.** The card exists; every card it depends on is green; the working tree is clean (`git status --short`). If not, say what is wrong and stop.
- **Fresh session.** If this conversation already built a segment or has been compacted, recommend `/drydock:handoff` and a fresh session first. The owner decides; "keep going" wins.
- **Mode.** Read the card's Mode. PANEL: run `/drydock:panel` on this card's design first, apply the verdict, then continue. CREW: on the full tier, run `/drydock:crew S3` instead of this loop; on other tiers, say what the crew costs, offer this loop as the standard alternative, and let the owner choose. REVIEW: this loop, plus the cold reader in the prove step. SOLO: this loop.
- **The one-sentence rule.** If the card is Size S and touches one place, skip the scout. Everything else still happens.
- **Model lanes.** You are the builder. The checker and the red team must not run on your model. Pass `model` explicitly to the Agent tool: if you are Opus, checker `sonnet`, red team `fable` (if unavailable, `opus`); if you are Sonnet, checker `opus`, red team `opus`; if you are Fable, checker `opus`, red team `sonnet`.

## Step 1: start and restate
```
DRYDOCK segment start S3
```
This freezes the exit test, marks the card "building", and turns the stop-gate on (the gate holds a "done" claim while the test command is red). Restate, in the owner's register: what they will be able to do when this is done, the exit-test clauses in plain words, the mode, and the plan for this session in five lines. Then: `git checkout -b seg/S3-<short-slug>` from main.

## Step 2: scout (unless the one-sentence rule applies, or the card touches no existing code)
Agent tool, `subagent_type: "drydock:scout"`, with the card text and the clauses. Use its build directives and its "must stay green" list. Add its checks-to-add to your plan.

## Step 3: tests first
For each clause, write the cheapest check that proves it (unit, integration, or a scripted browser walk), in the project's test framework. Run the test command:
```
DRYDOCK test
```
The new tests must **fail** now. If one passes before you build, the test is wrong or the clause is already true; fix the test or tell the owner. Register each new test so later segments re-run it:
```
DRYDOCK regression add S3 "<label>" "<command that runs just this test file>"
```

## Step 4: build, in small steps
Follow the directives. After each meaningful change run the typecheck (if configured) and the relevant test. When a test goes green, commit:
```
git add -A && git commit -m "S3: <what went green>"
```
Keep going until `DRYDOCK test` is green. Say what you are doing at each step in one line; show commands and the tail of their output, not summaries.

**Stuck rule.** Three honest attempts at the same failure, or a change that would widen the card's scope, or anything that needs the owner's data, money, or an account you do not have: stop, say what is blocking, give options with a recommendation, and wait. Never edit a test to make it pass. Never claim.

## Step 5: regression
```
DRYDOCK regression
```
Every earlier segment's checks must pass. A red earlier check is a blocker you fix before anything else.

## Step 6: check (fresh context, different model)
Agent tool, `subagent_type: "drydock:checker"`, `model` per the lane rule. Give it: the segment id, the frozen clauses from `.drydock/runs/S3/frozen.json` verbatim, `git diff main...HEAD --stat` plus the full diff path, the test command, and your claims as a short list. Do not give it your reasoning. Fix every blocker and major finding; re-run tests; re-run the checker if anything changed materially. Write its `clauseVerdicts` to `.drydock/runs/S3/graded.json`.

## Step 7: prove
1. **Red team.** Agent tool, `subagent_type: "drydock:red-team"`, `model` per the lane rule. Give it: segment id, clauses, the list of changed files (not your narrative), the local or preview URL, the test command. A BREACH is fixed and re-attacked. Keep the attack cases it wrote as permanent tests and register them.
2. **Walk.** On standard and full tiers, Agent tool `subagent_type: "drydock:walker"` with the card's "What you can do", the clauses, and the URL. On lite, start the app (`commands.dev`), open the URL yourself with `/verify` or the browser tools if available, and record what you saw; otherwise say plainly that the owner is the walker this time. Screenshots go to `docs/proofs/S3/walk/`.
3. **REVIEW mode only.** A cold reader: Agent tool, general-purpose, `model` on a lane you did not use, prompt built from a minimal string: the card text, `VISION.md`, and `git diff main...HEAD`. Nothing else. Ask: does the delivered thing do what the card and the vision ask, on its own terms? BLOCK with the exact gap, or ACCEPT.

## Step 8: grade the frozen bar
```
DRYDOCK map grade S3 --graded .drydock/runs/S3/graded.json
```
Exit 0 means every clause is echoed verbatim, met, and backed. Exit 3 means intact but not met: back to step 4. Exit 1 means the bar was dropped, softened, or widened: fix the graded file to echo the clauses exactly, or if a clause itself is wrong, change the card with the owner and re-freeze (`DRYDOCK segment start S3` again).

## Step 9: file the proof and close the segment
1. Write `docs/reviews/<date>-S3-proof-sheet.md` from `${CLAUDE_PLUGIN_ROOT}/templates/proof-sheet.md.tmpl`, with the clause table, the checker's and red team's findings, the walk, the regression result, and the commit sha. Say plainly what is not proven.
2. On standard and full tiers, run the honesty audit: Agent tool `subagent_type: "drydock:honesty"` with your draft stop message and the paths to the checker JSON, red team JSON, grade report, and test output. Send the rewritten summary if it says REWRITE. On lite, audit yourself against the same checklist in `${CLAUDE_PLUGIN_ROOT}/agents/honesty.md`.
3. Merge and mark:
```
git checkout main && git merge --no-ff seg/S3-<slug> -m "S3: <title> (exit test met)"
DRYDOCK segment done S3
```
4. Update `STATE.md`: last green S3 with the sha, in flight none, next up the next card.
5. `git add -A && git commit -m "S3: proof sheet and state"`.

## Step 10: stop and show the owner
End with the stop message shape from `voice.md`: what they can now do and where to try it; the exit test clause by clause with evidence; what the check and the red team found and what was fixed; what is not proven; then "Try it. If it does what you expected, say **next**. If not, tell me what's off." Put the line `Drydock claim: S3 exit test met.` at the very end. Nothing is pushed or deployed here; that is `/drydock:ship`.

If the bar is not met and you are stopping anyway (stuck rule), run `DRYDOCK gate release`, and say "S3 is **not met**" first, then what is missing. Never "done with caveats".
