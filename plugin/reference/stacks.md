# Choosing the stack

Drydock picks the stack from what the finished product must do, not from fashion. The owner can override any piece. Record the choice and the why in `DECIDED.md`.

| What the vision needs | Default stack | Why |
|---|---|---|
| A page or a few pages, no logins, no saved data (a class website, a reference, a one-off tool that runs in the browser) | **Static site**: plain HTML/CSS/JS or Vite, hosted on Netlify, code on GitHub | Nothing to secure, nothing to pay for, deploys in a minute, almost nothing can break |
| People sign in and their data is saved (a tracker, a log, a sign-up sheet, a dashboard) | **Vite + React** front end, **Supabase** for database and logins, **Netlify** hosting, **GitHub** code | Free tiers that are real; one database with built-in logins and row-level security; the most documented path for AI-assisted building |
| Content that someone edits often without touching code | Static site plus a simple admin (Supabase table and a protected page), or a hosted CMS if the owner already has one | Keep the editor out of the code |
| Mobile-first use by many people on phones | Same as the web app, built as a PWA (a web app that installs to the home screen) | One codebase, no app-store step, works offline with care |
| Money changes hands | Add Stripe in test mode first; the live key only on a CREW or REVIEW segment | Payments are where "it works" must be proven, not believed |

## Tests by stack
| Stack | Test runner | Typecheck | Browser walk |
|---|---|---|---|
| Vite + React (JavaScript) | Vitest (`npm test`) | none, or `npx tsc --noEmit` if TypeScript | Playwright (`npx playwright test`) or the Playwright MCP |
| Static site | Vitest for any logic; otherwise a Playwright smoke test that loads each page | none | Playwright |
| Supabase | Vitest tests against a **staging** project, never production; `supabase db diff` for schema | | |

## Accounts the owner creates herself (Drydock never creates accounts or types passwords)
| Service | Why | Where |
|---|---|---|
| GitHub | the code's home and the plugin's source | github.com, then `gh auth login` in the terminal |
| Netlify | hosting with a preview URL per change | netlify.com, then `netlify login` |
| Supabase | database and logins, only when the vision needs saved data or sign-in | supabase.com; one project per app to start, a second (staging) when real users arrive |

Keys never go in chat or in code. `docs/SECRETS.md` says where each lives. Hosting dashboards hold the values.
