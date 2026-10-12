---
name: "check"
description: "Runs the separate check on demand: re-runs every earlier segment's tests, then a fresh-context reviewer on a different model reads the current change against its card. Use when the owner asks \"is this right\", after manual edits, or when something feels off."
---

Read `${CLAUDE_PLUGIN_ROOT}/reference/voice.md`. Alias: `DRYDOCK` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs"`.

1. **Scope.** The argument names a segment (`S3`); otherwise use the active segment (`DRYDOCK segment current`); otherwise the whole map (then the card is "every green segment still holds").
2. **Regression first.** `DRYDOCK regression`. Show the table. A red line is the finding; stop there and report unless the owner asked for the review anyway.
3. **The reviewer.** Agent tool, `subagent_type: "drydock:checker"`, on a model that is not yours (Opus → `sonnet`; Sonnet or Fable → `opus`). Give it the segment id, the frozen clauses (`.drydock/runs/S3/frozen.json`, or freeze now with `DRYDOCK map freeze S3`), the diff (`git diff main...HEAD` or `git diff HEAD~1` if on main), the test command, and the owner's question if there was one. Not your reasoning.
4. **Report** in the owner's register: verdict, then findings by severity with the evidence, then what you recommend fixing now versus noting. Save its JSON to `.drydock/runs/S3/check-<date>.json` and its clause verdicts to `.drydock/runs/S3/graded.json`.
5. **Fix only on the owner's go**, then re-run the tests and show the result. Do not mark anything green here; that is the build skill's job (`DRYDOCK map grade S3` then `segment done`).
