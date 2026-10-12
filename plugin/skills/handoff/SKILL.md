---
name: "handoff"
description: "End-of-session note so the next session starts warm. Writes docs/handoffs/<date>-<project>-<topic>.md, takes a snapshot, updates STATE.md. Use when the owner says \"handoff\", \"stopping for today\", or after a segment is shown."
---

Read `${CLAUDE_PLUGIN_ROOT}/reference/voice.md`. Alias: `DRYDOCK` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs"`.

1. Pick a short topic slug (the segment id and two words). Get the filename: `DRYDOCK handoff-path <slug>`.
2. Write it from `${CLAUDE_PLUGIN_ROOT}/templates/handoff.md.tmpl`. The first four sections are facts only: what actually happened, real paths, real commands, real shas, real URLs. Interpretations go under "Notable learnings". Never include secret values or claims of success that were not verified this session.
3. `DRYDOCK snapshot`.
4. Update `STATE.md` so it agrees with the handoff (last green, in flight, next up, open threads).
5. If the stop-gate is on for an unfinished segment, leave it on; note in the handoff that the segment is mid-build and what the next step is.
6. Commit locally: `git add -A && git commit -m "handoff: <slug>"`. Nothing is pushed.
7. Tell the owner, in three lines: the handoff file, the one next move, and "Start the next session fresh and type `/drydock:wake`."
