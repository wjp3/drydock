---
name: "help"
description: "Explains Drydock in plain English: the five verbs, the commands, and what to do next. Use when the owner asks what Drydock is, how it works, or what to type."
---

Read `${CLAUDE_PLUGIN_ROOT}/reference/voice.md` and, if it exists, `.drydock/config.json` (for the owner's level). Then explain, briefly and in the owner's register:

**What Drydock is.** A way of building with Claude that stops the four ways builds fail: starting without a plan, fixes that break other things, losing track between sessions, and Claude saying done when it isn't. You describe what you want. Drydock turns it into a map of small segments, each with a test that says when it is done. It builds one segment at a time, has a separate check review the work, attacks it, walks it like a person, and stops to show you the evidence. Nothing goes live without your go.

**The five verbs.**
| Verb | What happens | Command |
|---|---|---|
| Plan | an interview, then `VISION.md` and `BUILD-MAP.md` | `/drydock:plan` |
| Build | one segment: test first, build, commit at green | `/drydock:build S3` |
| Check | a fresh reviewer re-runs the tests and reads the change against the card | `/drydock:check` (build runs it for you) |
| Prove | the red team attacks it; the running app is walked; a proof sheet is filed | `/drydock:prove` (build runs it for you) |
| Remember | where we are, what is settled, a handoff for next time | `/drydock:wake` to start, `/drydock:handoff` to end |

**Also:** `/drydock:setup` (first time), `/drydock:status` (where are we), `/drydock:ship` (preview, then live with your go), `/drydock:panel` (several expert lenses on a decision), `/drydock:crew` (the full build crew, full tier only).

**How a session goes.** Start with `/drydock:wake`. Build one segment. Try what it built. Say "next" or say what is off. End with `/drydock:handoff`. Start the next segment in a fresh session.

**The rules that protect you.** You decide; Drydock recommends. Every "done" comes with the command and its output or a screenshot. Nothing is pushed or deployed without your yes for that exact step. If Drydock gets stuck three times, it stops and tells you instead of pretending.

If there is no `.drydock/config.json` here, end with: "This folder isn't set up yet. Run `/drydock:setup` to begin." Otherwise end with the one thing to do next, from `node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" status`.
