# The Drydock method

Drydock exists because builds with an AI fail in four ways, and each has a fix that must be structural, not a reminder.

| How builds fail | The fix | Where it lives in Drydock |
|---|---|---|
| **No plan, so Claude improvises.** The idea goes in, code comes out, nobody wrote down what done means. | A written vision and a map of segments, each with a binary exit test, before any code. | `/drydock:plan` → `VISION.md`, `BUILD-MAP.md` |
| **Fixes break other things.** No tests, no idea what else touches the changed code. | Test first. A blast-radius look before editing existing code. Every earlier segment's checks re-run before any new claim. Commit at every green. | `/drydock:build`, `drydock regression`, the typecheck hook |
| **Context lost between sessions.** A new session starts cold and re-decides or forgets. | Memory in files: `STATE.md`, `DECIDED.md`, handoffs, snapshots before compaction, one segment per session. | `/drydock:wake`, `/drydock:handoff`, the session-start and pre-compact hooks |
| **Claude says done when it isn't.** It grades its own work, and it grades generously. | Nothing is done on the builder's say-so. The exit test is frozen verbatim, a fresh-context checker on a different model re-derives the claims, a red team attacks, the running app gets walked, and the summary is audited before the owner reads it. | `/drydock:check`, `/drydock:prove`, `drydock map grade`, the stop-gate hook |

## The five verbs

1. **Plan.** Interview the owner until a stranger could build it from `VISION.md` alone. Write the map. Review the map with lenses the owner does not have. The first segment, S0, is always "the skeleton is live": empty app at a URL, test command green, code on GitHub. S0 proves the whole path before any feature exists.
2. **Build.** One segment. Freeze its exit test. Turn each clause into a runnable test or scripted walk that fails. Build until it passes. Commit at every green.
3. **Check.** A fresh-context checker on a different model reviews the diff against the card and runs the tests itself. Earlier segments' checks re-run. Gaps that affect correctness or the stated requirements get fixed. Style opinions do not.
4. **Prove.** A red team attacks the segment's surface with inputs the builder never tried, both directions on any rule or guard (the hole it closed and the case it may now over-refuse). The running app is walked the way a person would use it. Evidence is filed on a proof sheet.
5. **Remember.** `STATE.md` says where we are. `DECIDED.md` says what is settled. A handoff closes the session. The next session opens with `/drydock:wake`.

## Standing rules

- **The owner decides.** Drydock advises, proposes better defaults, and shows evidence. It never waits on the owner for things it can propose, and never acts outside this computer without a go for that exact step.
- **Evidence, not adjectives.** "The tests pass" means: the command, its exit code, and the last lines of its output are shown. "It works" means: a screenshot path or the exact text read from the screen.
- **A different model checks the builder.** If the session runs on Opus, the checker runs on Sonnet and the red team on Fable or Opus at high effort; on Sonnet, the checker runs on Opus; on Fable, the checker runs on Opus and the red team on Sonnet at high effort. Same context, same blind spots. Same model, similar blind spots.
- **The one-sentence rule.** If the change can be described in one sentence and touches one place, skip the plan and the panel. Write the test, make it green, commit.
- **One segment per session.** Context fills, and quality drops as it fills. After a segment, hand off and start fresh. After a compaction, re-read `STATE.md` and the newest snapshot before continuing.
- **Right-size the machinery.** Panels and the crew are earned by the build, not applied by default. See `tiers.md`.
- **Every control names its failure.** Each hook, script, and seat says which of the four failures it stops and when it can be retired. A control that no longer catches anything is removed, because every component in a harness encodes an assumption about what the model cannot do on its own, and models change.
- **Honest wording.** Never "done with caveats" over a red exit test. The honest word is "not met", followed by what is missing.

## The build loop in one picture

```
card  ->  freeze exit test  ->  write failing tests  ->  build  ->  tests green  ->  commit
      ->  regression (earlier segments)  ->  checker (fresh, other model)  ->  fix gaps
      ->  red team  ->  walk the running app  ->  grade the frozen bar by echo  ->  proof sheet
      ->  commit, mark green, STATE.md  ->  STOP and show the owner
```

The stop at the end is the design, not a limitation. The owner tries it, says "next", and the next segment starts in a fresh session.
