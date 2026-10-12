---
name: "panel"
description: "Convenes a panel of expert lenses on a decision, a card, or the whole build map, sized to the tier, and files a verdict with a plain-English companion. Builds the roster first if the project has none. Use when the owner says \"convene the panel\", \"get a second opinion\", or a card is in PANEL mode."
---

Read `${CLAUDE_PLUGIN_ROOT}/reference/voice.md`, `tiers.md`, and `roster-building.md`. The panel advises; the owner decides. Every finding cites where it came from.

## 1. Scope
The argument, or the active card, or "the build map". Write it as one sentence: "the design of S4, the teacher's dashboard" or "the build map as a whole".

## 2. Roster
If `docs/PANEL.md` does not exist, build it now from `${CLAUDE_PLUGIN_ROOT}/templates/PANEL.md.tmpl` and `SEAT.md.tmpl`, following `roster-building.md`: the five standing lenses plus the domain seats the vision touches, each with a Focus and a Hunt written for this build. Show the roster to the owner in five lines and ask for one change. Size by tier: lite 3 seats (no workflow), standard 3 seats and 1 round, full 5 to 7 seats and up to 2 rounds.

## 3. Briefings
Make `docs/reviews/run-<topic>-<date>/`. Write `_common.md` holding the standing rulings from `DECIDED.md`, the vision, the scope under review (the card or map text verbatim), and any research notes gathered now (web lookups happen here, before the run, never inside it). Write one `<seat-id>.md` per seat: `_common.md` plus that seat's Focus and Hunt. Seats read one file each.

## 4. Run
- **lite**: run the three seats as Agent-tool subagents (general-purpose, `model: opus`), each prompted with: read only your briefing file; up to 7 findings; each KEEP/FIX/ADD/DELETE/DIRECTION with severity, surface, argument, exact change, evidence. Then cluster and dedupe their findings yourself, mark agreement (how many seats raised it), and write the verdict.
- **standard** and **full**: the Workflow tool with `name: "drydock:panel-run"` and `args: { "scope": "<scope>", "roster": [{ "id": "...", "focus": "..." }], "briefDir": "<absolute path>", "rounds": 1 or 2 }`. If the named workflow is not found, pass `scriptPath` pointing at `${CLAUDE_PLUGIN_ROOT}/workflows/panel-run.js` with the same args. The run is long; start it, tell the owner it will take a while, and keep the session free. Ask for keep-awake if the host offers it.

## 5. File before presenting
Write `docs/reviews/<date>-panel-<topic>-verdict.md` from `${CLAUDE_PLUGIN_ROOT}/templates/verdict.md.tmpl` (ranked findings, owner decisions, direction, what was dropped for the cap) and the companion from `verdict-plain-english.md.tmpl`. A panel that is not filed did not happen.

## 6. Present
In the owner's register: what the room agreed on, what it argued about and how it landed, what only the owner can decide (one at a time, with your recommendation), and the direction. Apply only the changes the owner accepts; record rulings in `DECIDED.md`.
