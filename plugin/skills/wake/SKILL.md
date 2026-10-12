---
name: "wake"
description: "Start-of-session orientation. Reads STATE.md, the map, the newest handoff and verdict, and git, then gives a plain-English read-back and one recommended next move. Use at the start of every session, after a compaction, or when the owner says \"where were we\"."
---

Orientation, not an audit. Read light, report tight, then wait. Read `${CLAUDE_PLUGIN_ROOT}/reference/voice.md`.

1. If there is no `.drydock/config.json` here, say so and recommend `/drydock:setup`. Stop.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" status`.
3. Read `STATE.md`, `DECIDED.md` (skim the table), the newest file in `docs/handoffs/`, the newest file in `docs/reviews/`, and the newest file in `.drydock/snapshots/` if the session was just compacted. Read the active or next card in `BUILD-MAP.md`. Do not read the whole map or whole code.
4. Cross-check and report, don't fix: `git status --short`, `git log -3 --oneline`, anything unpushed (`git log origin/main..HEAD --oneline` if a remote exists). If `STATE.md` and the newest handoff disagree, say so and cite both; the newer usually wins.
5. Read back in the owner's register, under 15 lines: where we are (segments green of total, MVP line), what went green last, the active or next segment and its exit test in plain words, open threads, anything drifted or risky, and **one recommended next move**.
6. Stop and wait. Do not start building.
