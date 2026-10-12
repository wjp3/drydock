---
name: "prove"
description: "Attacks a segment and walks the running app, then files a proof sheet. The red team tries inputs the builder never tried, both directions on every rule; the walker uses the app like a person. Use before shipping, on REVIEW cards, or when the owner asks \"is it safe\" or \"does it really work\"."
---

Read `${CLAUDE_PLUGIN_ROOT}/reference/voice.md` and `exit-tests.md`. Alias: `DRYDOCK` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs"`.

1. **Scope and target.** Segment from the argument or the active one. Target URL: the local dev server (start it with `commands.dev` if needed) or the preview URL from `.drydock/config.json`. Never a live site holding real people's data unless the owner says so in this conversation.
2. **Red team.** Agent tool, `subagent_type: "drydock:red-team"`, on a model that is not yours (Opus → `fable`, fallback `opus`; Sonnet → `opus`; Fable → `sonnet`). Give it: the segment id, the clauses, `git diff main...HEAD --name-only`, the target URL, the test command. Not the builder's narrative.
3. **Walk.** Agent tool, `subagent_type: "drydock:walker"`, with the card's "What you can do when it's done", the clauses, the URL, and any test login the project's own seed or example files provide. On lite, if no browser tool is available to the walker, do the walk yourself with the built-in browser or `/verify`, or say plainly that the owner is the walker this time and give them the exact clicks.
4. **REVIEW cards.** Add the cold reader: a general-purpose agent on a lane you did not use, given only the card text, `VISION.md`, and the diff. ACCEPT or BLOCK with the gap.
5. **Fix** any BREACH or BLOCK, re-run tests, re-attack the fixed guard both directions. Keep the red team's attack cases as permanent tests: `DRYDOCK regression add S3 "<label>" "<command>"`.
6. **Proof sheet.** Write `docs/reviews/<date>-S3-proof-sheet.md` from `${CLAUDE_PLUGIN_ROOT}/templates/proof-sheet.md.tmpl`. Screenshots live in `docs/proofs/S3/walk/`, attack bodies in `docs/proofs/S3/red-team.md`.
7. **Report** in the owner's register: what was attacked and held, what broke and was fixed, what the walker saw, and what is not proven. One recommendation.
