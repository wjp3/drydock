# The crew (full tier)

The crew is the build loop with every check done by an independent seat, and the pass/fail decided by deterministic gates rather than anyone's narrative. It runs as one workflow (`drydock:crew-run`) on a CREW card. It costs 15 to 25 agent runs and one to three hours. It is worth it when a segment holds logins, other people's data, money, or a rule that must never fail. It is not worth it for a screen.

## The cadence
```
Pre-flight  freeze the exit test (Control A); refuse to run without a frozen bar
Recon       4 scouts in parallel, each blind to the others: fixes, safety design, domain key, blast radius
Build+Prove bounded rounds: builder -> (independent scorer || red team); the scorer's last act is the echo-grade of the frozen bar
Verify      4 adjudicators in parallel: vision (owner's lens), checker (walks every affected screen, runs regression), correctness, honesty
Report      synthesizer writes OWNER-READ.md (plain English) and RESULT.md (receipts)
Acceptance  relay auditor (traces every claim in OWNER-READ.md to a receipt) || cold reader (sees only the card, the vision, and the diff) || live walker (drives the deployed app)
```

## Seats and lanes
"Lane" means which model family runs the seat. The builder never shares a lane with the seats that check it.

| Seat | Phase | Lane | Independent of | Catches |
|---|---|---|---|---|
| preflight | Pre-flight | small | | a paraphrased or missing bar |
| scout:fixes | Recon | small | the handed findings (blind) | framing that misses a fix |
| scout:safety-design | Recon | small | | a guard with no chokepoint |
| scout:domain-key | Recon | small | | a wrong idea of what "correct" means |
| scout:blast-radius | Recon | small | | neighbors the change breaks |
| builder | Build+Prove | build | | |
| scorer | Build+Prove | check (high effort) | the builder | false claims; a probe green on both the fixed and the broken branch |
| red-team | Build+Prove | check (high effort) | the builder, the safety scout, the scorer's verdict | bypasses; a guard that over-refuses the good case |
| adj:vision | Verify | build | the builder's narrative | over-claims against the vision |
| adj:checker | Verify | small | the maker path | screens that broke; coverage rot |
| adj:correctness | Verify | small (high) | the browser | file-level wrongness; the opposite failure mode |
| adj:honesty | Verify | small (high) | the narratives | a claim that outruns its evidence |
| synth | Report | build | | |
| relay-auditor | Acceptance | check (high) | the synth's self-summary | over-claims in what the owner reads; "done with caveats" over a red bar |
| cold-reader | Acceptance | small (high) | everything the crew produced | delivered is not what was asked |
| live-walker | Acceptance | check (high) | the crew's narrative and probes | the app does the wrong thing while rendering fine |

Default lanes: build = `opus`, check = `fable` at high effort (falls back to `opus` at high effort when unavailable), small = `sonnet`. If the owner's plan lacks a model, Claude Code substitutes; the workflow records the lane it asked for so the summary can say when the model-mix defense did not hold.

## Deterministic gates (no model, unpersuadable)
| Control | What it does | Failure it closes |
|---|---|---|
| A, the exit-test binder | `drydock map freeze` before build; `drydock map grade` by verbatim echo every round. Exit 1 forces the round to "not met" regardless of the scorer's words. | a rung that self-declared done against a paraphrased bar |
| C, the regression battery | `drydock regression` runs every earlier segment's checks; a fail is a blocker when the segment touches an earlier one | a fix that regressed its neighbor |
| D, swarm integrity | a required seat that returned nothing is a BLOCK, never a silent drop | null seats dropped silently and the run self-declared complete |
| F, roster pre-flight | module seats bind from the card's flags: untrusted input → red team; a guard authored or edited → red team both directions; a walkable surface → live walker. Silence is never a waiver | a required seat left out by forgetting |

## Honest limits
- A Verify-phase BLOCK does not reopen a build round; it fails acceptance. The owner decides whether to run again.
- The relay license constrains what the orchestrator may tell the owner; it cannot audit the text after the fact.
- All lanes are Claude-family models. This is model diversity, not vendor diversity.

## Retirement rule
Each seat exists because a specific failure happened once. When a seat has not changed an outcome in ten runs, propose removing it to the owner with the ten run ids. Keep the deterministic gates; they are cheap and unpersuadable.
