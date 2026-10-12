---
name: "plan"
description: "Interviews the owner until the finished product is clear, then writes VISION.md and BUILD-MAP.md (segments with binary exit tests), picks the stack, and gets the map reviewed by lenses the owner does not have. Use when the owner wants to start a build, describe an idea, or re-plan."
---

Read `${CLAUDE_PLUGIN_ROOT}/reference/voice.md`, `method.md`, `exit-tests.md`, `map-format.md`, `stacks.md`, and `tiers.md` from `${CLAUDE_PLUGIN_ROOT}/reference/`. Read `.drydock/config.json` and `DECIDED.md`. If `.drydock/config.json` does not exist, run `/drydock:setup` first.

Planning has five steps. Name each as you start it.

## Step 1 of 5: the interview
Goal: a stranger could build the right thing from `VISION.md` alone. Use the AskUserQuestion tool for choices and plain questions for stories. One topic per round. Do not ask what you can infer. Dig into the hard parts the owner has not considered. Stop when you can write every section of the vision without guessing, or after about eight rounds, whichever comes first. If the owner says "just build it", stop asking and draft: state your assumptions in the vision's "Things we are assuming" section and let them correct it. Propose; do not interrogate.

Cover, in roughly this order:
1. **Who** uses it, and the moment they first open it. What were they doing before? What do they do in the first minute?
2. **The core loop.** The one thing a person does again and again. What they see after. What "it worked" looks like to them.
3. **Day one versus someday.** What must exist for one real person to use it for the real purpose (the MVP). What can wait.
4. **Data.** Does anything need to be remembered between visits? Whose data is it? Who may see it? Children or students? Health, money, legal?
5. **Logins.** Do people sign in? How many kinds of people (roles)? What must one kind never be able to do?
6. **Devices and places.** Phones? Classrooms with bad wifi? Shared computers?
7. **Must-nevers.** The things that would make the owner pull the plug: a child seeing another child's data, an email sent by mistake, a score lost.
8. **What already exists.** Spreadsheets, forms, an old app, a design, a logo. Anything to reuse or import.
9. **Constraints.** Deadline, hours per week the owner has, money (free tiers only?), rules the institution imposes.
10. **Done.** In the owner's own words: "When I can ___, this is finished."

## Step 2 of 5: VISION.md
Write `VISION.md` from `${CLAUDE_PLUGIN_ROOT}/templates/VISION.md.tmpl`, in the owner's words wherever you have them. The MVP definition is the smallest thing a real person can use for the real purpose. Read the promise paragraph back to the owner and ask for one correction.

## Step 3 of 5: the stack and the commands
Choose from `stacks.md`. Prefer the simplest row that meets the vision. Record it with the why in `DECIDED.md` (row 2) and in `CLAUDE.md`'s stack table. If the build holds logins, other people's data, or money and the tier is lite or standard, recommend full for those segments only (CREW mode on those cards) and explain the cost in one line; the owner decides.

Set the commands you will rely on (they are the stack's defaults until S0 proves them):
```
node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" config set commands.install "npm install"
node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" config set commands.dev "npm run dev"
node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" config set commands.test "npm test"
node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" config set commands.build "npm run build"
node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" config set stack.kind "<web-app|static-site|other>"
```
Adjust to the stack. Set `commands.typecheck` only if the stack is TypeScript.

## Step 4 of 5: BUILD-MAP.md
Write `BUILD-MAP.md` from `${CLAUDE_PLUGIN_ROOT}/templates/BUILD-MAP.md.tmpl`, cards from `SEGMENT-CARD.md.tmpl`, in the exact shape `map-format.md` describes. Rules:
- **S0 is always the skeleton**: an empty app with its name, at a preview URL, with the test command green and the code on GitHub. S0 proves the whole path before any feature. Keep the template's S0 card and fill its notes with the stack's specifics.
- **Dependency order.** Each card depends only on earlier cards. Data shape and logins come before the screens that need them.
- **Small cards.** A card is one thing a person can do, or one invisible thing with a clear test. Size S is an hour or two of building; M a session; L two sessions. Split anything larger.
- **Exit tests are binary and observable.** Two to five clauses per card, each testable (see the weak/strong table). Every must-never in the vision has at least one clause somewhere that enforces it, not just hides it.
- **Modes.** SOLO by default. PANEL where a design decision is contested or expensive to reverse. REVIEW where other people's data, logins, or money appear. CREW only when the tier is full (or the owner chose it for that card). Give the reason in parentheses.
- **The two finish lines.** The MVP line is after the last card a real person needs to use it for the real purpose. The Finished line is after the last card in the vision.
- **The parking lot** holds every good idea that is not on the map.
Then check the shape: `node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" map list`. Fix anything the parser does not see.

## Step 5 of 5: the review
Lenses the owner does not have, sized by tier:
- **lite**: run the `drydock:map-critic` subagent (Agent tool, `subagent_type: "drydock:map-critic"`) with the paths to `VISION.md`, `BUILD-MAP.md`, `DECIDED.md`.
- **standard**: run `/drydock:panel` on "the build map" with 3 seats, 1 round.
- **full**: run `/drydock:panel` on "the build map" with 5 to 7 seats.
Apply the findings marked FIX, ADD, or DELETE with strong agreement directly to the map and say what changed. Bring the OWNER decisions to the owner one at a time with your recommendation. Record rulings in `DECIDED.md`. Re-run `map list` after edits.

## Finish
Update `STATE.md` (in flight: none; next up: S0). Commit: `git add -A && git commit -m "Drydock: vision and build map"`. Read back in the owner's register: the promise, the number of segments to the MVP line and to the Finished line, the stack in one sentence, and the mode of any non-SOLO card with its reason. End with: "Next: `/drydock:build S0`. Start it in a fresh session." Stop.
