---
name: "ship"
description: "Deploys what is green: preview first, verified by loading it, then live only on the owner's explicit go, then push, then STATE.md and a handoff. Use when the owner says \"ship it\", \"deploy\", \"put it live\", or \"push\"."
---

Read `${CLAUDE_PLUGIN_ROOT}/reference/voice.md`. Alias: `DRYDOCK` = `node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs"`. Nothing in this skill leaves the computer without the owner's go for that exact step; the plugin's gate hook also asks if a go was not recorded.

## Preflight
1. `git status --short` must be clean and you must be on `main`. State in one line what is shipping (the segments green since the last ship).
2. `DRYDOCK regression` must be green. If the stack has a typecheck, run it. A red here stops the ship.
3. First ship ever? Set up the path once, each with the owner's go:
   - GitHub: `gh repo create <name> --private --source=. --remote=origin` (the gate hook will ask; the owner's yes in chat is the go). Public only if the owner says so.
   - Netlify: `netlify init` (links or creates the site), or `netlify sites:create`. Record the site name in `.drydock/config.json` → `urls`.
   - Supabase, when the stack uses it: the owner creates the project in the browser; record its ref in `docs/SECRETS.md` (the ref is not a secret; the keys are, and they live in Netlify's environment settings, never in code).

## Build once, deploy preview
1. `commands.build` (from config). Show the tail.
2. `netlify deploy --dir=<build output>` (no `--prod`). This makes a preview URL nobody else sees unless given the link.
3. **Verify by loading it**: `curl -sS -o /dev/null -w "%{http_code}" <preview url>` expecting 200, and `curl -sS <preview url> | grep -i "<a marker of this change>"`. For a visible change, open it in the browser tools and take a screenshot to `docs/proofs/ship/<date>/`. Show the evidence. Save the URL: `DRYDOCK config set urls.preview "<url>"`.

## Gate: live
Ask the owner, exactly: "Preview verified at <url>. Go live?" Only on a clear yes:
```
DRYDOCK gate open deploy
netlify deploy --prod --dir=<build output>
```
Verify the live URL the same way. Show the evidence. Save it: `DRYDOCK config set urls.live "<url>"`.

## Gate: push
Ask: "Push the code to GitHub?" (The owner's earlier "yes" covers this only if they said so.) On yes:
```
DRYDOCK gate open push
git push -u origin main
```
Show `git log origin/main -1 --oneline`.

## Record
1. `STATE.md` → "Last shipped": date, sha, preview URL, live URL.
2. `DECIDED.md`: any ruling made during the ship (site name, public or private repo).
3. Run `/drydock:handoff`.
4. One-line summary: sha · preview ✓ · live ✓ or "not taken live" · pushed ✓ or "not pushed" · handoff file.

If any verification fails: stop, show the failure, propose the fix. Do not continue down the list.
