# BUILD-MAP.md format (what the parser reads)

The map is Markdown a person can read and a script can parse. Keep this shape exactly.

```
> **MVP line:** after S4
> **Finished line:** after S9

## S3 - Students can log a book
- **Status:** todo
- **Mode:** SOLO (one screen, one table, no new permissions)
- **Size:** M
- **Depends on:** S1, S2
- **What you can do when it's done:** A signed-in student picks a book and taps Log. It appears in their list with today's date.
- **Exit test:**
  - [ ] Logging a book as a signed-in student adds one row to `reading_logs` with that student's id and today's date
  - [ ] The logged book appears at the top of the student's list without a page reload
  - [ ] A signed-out visitor who requests `/api/log` gets 401 and no row is written
- **How we'll check it:** `npm test -- log.test` plus a browser walk of the Log screen on the preview URL
- **Reuses / touches:** `src/pages/Log.jsx`, `src/lib/db.js`, the `reading_logs` table
- **Notes:** The date is the student's local date, not the server's.
```

## Rules the parser relies on
- A card starts with `## S<number>[letter] - <title>`. The separator may be `-`, `:`, or a dash character. Nothing else at level `##` inside the segments area.
- Fields are bullets with the bold label exactly as shown: `Status`, `Mode`, `Size`, `Depends on`, `What you can do when it's done`, `Exit test`, `How we'll check it`, `Reuses / touches`, `Notes`.
- Exit-test clauses are **indented** checkbox bullets under `**Exit test:**`, one clause per line. The text after `[ ]` is the clause, frozen verbatim. `drydock map mark S3 green` ticks them.
- `Status` is one word: `todo`, `building`, `green`, `blocked`.
- `Mode` is one word first, a reason in parentheses after: `SOLO`, `PANEL`, `REVIEW`, `CREW`.
- The two finish lines are blockquote lines at the top: `> **MVP line:** after S4` and `> **Finished line:** after S9`.
- A "Parking lot" section at the end holds ideas that are not on the map. It is not parsed.

Check your map any time: `node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" map list`.
