---
name: "crew"
description: "Runs the full build crew on one CREW-mode segment (full tier): independent scouts, builder, scorer, red team, adjudicators, relay auditor, cold reader, live walker, with deterministic gates. Long and costly; use only on segments that hold logins, other people's data, money, or rules that must never fail."
---

Read `${CLAUDE_PLUGIN_ROOT}/reference/crew.md` and `voice.md`. Alias: `DRYDOCK` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs"`.

## Preflight (the orchestrator's job, outside the run)
1. The segment is a CREW card, or the owner chose the crew for it. Its dependencies are green. The tree is clean.
2. Dynamic workflows are available (on Pro they must be on in `/config`). The Playwright MCP is present if the card has a walkable surface; otherwise the live walk cannot run and you must say so now.
3. Cost, stated plainly: about 15 to 25 agent runs, one to three hours, usage that counts against the plan. Ask: "Run the crew on S7?" Only on yes.
4. `DRYDOCK segment start S7` (freezes the bar; the crew refuses to run without it).
5. Fill the brief from the card and the config:
```json
{
  "segment": "S7", "title": "...", "clauses": [{ "id": "S7.1", "text": "..." }],
  "repo": "<absolute path>", "base": "main", "branch": "seg/S7-crew",
  "testCmd": "<commands.test>", "typecheckCmd": "<commands.typecheck or empty>", "devCmd": "<commands.dev>",
  "appUrl": "<local or preview url or empty>", "walkTasks": ["<from the card's What you can do>"],
  "findings": "<the scout-ready description of what to build, from the card>",
  "flags": { "untrustedInput": true, "guardAuthoredOrEdited": true, "touchesEarlierSegments": true, "walkable": true },
  "safeFallback": "<what to ship if it cannot be made robust: usually gate the feature off>",
  "maxRounds": 3, "lanes": { "build": "opus", "check": "fable", "small": "sonnet" },
  "runsDir": "<absolute path to .drydock/runs/S7>", "drydockCli": "<absolute path to scripts/drydock.mjs>"
}
```
Every flag is explicit. Silence is never a waiver.

## Run
Workflow tool, `name: "drydock:crew-run"`, `args: { "brief": <the brief> }`. If the name is not found, `scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/crew-run.js"`. Run it in the background and tell the owner it is running and roughly how long. Ask for keep-awake if the host offers it.

## After the run (mandatory, before saying anything to the owner)
1. Read the result. `missingSeats` non-empty is a BLOCK, whatever else it says: a required seat that returned nothing is never a pass.
2. `accepted` is true only if the build passed, the relay auditor said PASS, the cold reader said ACCEPT, the live walker (when it bound) said ACCEPT, and no seat is missing.
3. `DRYDOCK map grade S7 --graded <runsDir>/graded.json` must exit 0 before any green.
4. Relay **only within** `relayLicense`: the exact claims the auditor licensed, each at its stated strength. Anything else is an unlicensed claim. Lead with HALT if the bar was not met.
5. File `OWNER-READ.md` and `RESULT.md` from the run into `docs/reviews/<date>-S7-crew-owner-read.md` and `-result.md`. Note in the owner read whether the requested model lanes were honored (the result records what it asked for).
6. If accepted: merge the branch, `DRYDOCK segment done S7`, `STATE.md`, commit. If not: leave the branch, `DRYDOCK gate release`, and tell the owner what is missing and the choices (another round, a smaller card, the safe fallback).
