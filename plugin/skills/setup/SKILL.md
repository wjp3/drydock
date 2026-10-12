---
name: "setup"
description: "First-time setup of Drydock in a project folder. Checks the machine, asks about the owner and their plan, picks the tier, scaffolds the memory files, and offers the companion tools. Use when the owner says \"set up Drydock\", \"get started\", or when no .drydock folder exists."
---

Read `${CLAUDE_PLUGIN_ROOT}/reference/voice.md`, `${CLAUDE_PLUGIN_ROOT}/reference/tiers.md`, and `${CLAUDE_PLUGIN_ROOT}/reference/companions.md` first. Speak as if to a non-coder until the interview says otherwise. Name each step before doing it. Four steps.

## Step 1 of 4: check this computer
Run:
```
node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" doctor --json
```
Show a short table: tool, present or missing. Essentials are **node** (20 or newer), **git**, and **gh** (the GitHub command-line tool). For each missing essential, give the install link and stop until it is installed: Node from https://nodejs.org (choose LTS), git from https://git-scm.com (on a Mac, `xcode-select --install` in the Terminal also works), gh from https://cli.github.com. If `ghAuth` is not present, the owner runs `gh auth login` in their terminal and follows the browser prompt; Drydock never types passwords. If Claude Code offers an update, recommend `claude update`.

## Step 2 of 4: a few questions
Use the AskUserQuestion tool. One round, four questions, each with a recommended option first:
1. **Your Claude plan**: Pro / Max / Team or Enterprise / API key / Don't know. (Decides the default tier.)
2. **How technical are you**: I build by describing what I want and don't read code / I'm comfortable with technical terms but don't write code / I write some code. (Decides the voice and who makes technical calls.)
3. **This folder**: a new empty project / existing code I want to keep working on.
4. **What are you building, in one sentence** (free text via Other). Then ask separately for a short name.

Decide the tier from the plan (Pro or unknown → lite; Max or Team → standard; the plan skill upgrades to full later if the build turns out to hold logins, other people's data, or money). Say which tier you chose and why, and that it can be changed any time.

## Step 3 of 4: scaffold the memory files
1. If this folder is not a git repository: `git init -b main`.
2. Initialize Drydock:
```
node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" init --name "<name>" --tier <tier> --level <non-coder|fluent|coder> --plan <plan> --os <mac|windows|linux>
```
3. Save the one-sentence description: `node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" config set project.oneLiner "<sentence>"`.
4. Create from the templates in `${CLAUDE_PLUGIN_ROOT}/templates/`, filling every `{{PLACEHOLDER}}` (leave stack and command rows as "to be decided in /drydock:plan" where unknown):
   - `CLAUDE.md` from `CLAUDE.md.tmpl`. If a `CLAUDE.md` already exists, append the "Files that hold the memory", "Rules", and "Drydock commands" sections under a heading `## Drydock` instead of replacing it.
   - `STATE.md` from `STATE.md.tmpl` (last green: none; in flight: setup; next: plan).
   - `DECIDED.md` from `DECIDED.md.tmpl` (rows 1 and 3 filled; row 2 "stack: decided in planning").
   - `docs/SECRETS.md` from `SECRETS.md.tmpl`.
5. For existing code: run the project's test command if one is obvious from `package.json` or a README and record it: `drydock config set commands.test "<cmd>"`. Record `dev`, `build`, and `typecheck` the same way when they are obvious. Do not invent commands.
6. Commit locally: `git add -A && git commit -m "Drydock: scaffold (tier <tier>)"`. A local commit stays on this computer; nothing is pushed.

## Step 4 of 4: companion tools and accounts
From `${CLAUDE_PLUGIN_ROOT}/reference/companions.md`, offer with one AskUserQuestion (multi-select) the companions that fit: context7 always; the Netlify MCP and CLI if anything will be hosted; the Supabase MCP only if the one-sentence description implies logins or saved data (otherwise defer it to planning); Playwright MCP on standard and full tiers (on lite, offer it as optional and say what it adds). Install exactly what was chosen with the commands in that file, then verify with `claude plugin list` and `claude mcp list` and show the result. A name the marketplace does not list is skipped and reported, never guessed.

Accounts the owner creates themselves, in the browser, when the build needs them: GitHub (needed at S0), Netlify (needed at S0 if hosting), Supabase (when the plan says so). Give the links. Do not block setup on them.

If the tier is standard or full and the plan is Pro, say: "Panels use Claude Code's dynamic workflows. On Pro, turn them on once: type `/config` and switch on Dynamic workflows."

## Finish
Read back in five lines: tier, level, what was created, what was installed, what is still to do (accounts). Then: "Next: run `/drydock:plan` and I'll interview you about what you want to build." Stop.
