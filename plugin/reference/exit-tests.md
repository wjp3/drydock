# Writing an exit test

An exit test is the definition of done for one segment. It is **binary**: every clause is either met or not, with evidence a stranger could check. It is **frozen** when the segment starts (`drydock segment start S3`) and graded by **echo**: the grader must repeat each clause word for word beside its verdict, so a softened or paraphrased bar shows up as a text difference, not a judgment call.

## A good clause
- Names one observable thing: a command and its exit code, a URL and what it shows, a file that exists, a number that is zero.
- Can be turned into a test, a script, or a scripted browser walk.
- Says nothing about how it was built.
- Fits on one line.

| Weak | Strong |
|---|---|
| Users can log in | A new user can sign up with an email and password, sign out, sign back in, and land on `/home` with their name shown |
| The form works | Submitting the form with an empty title shows the message "Title is required" and saves nothing |
| It's fast | The list page loads in under 2 seconds with 500 rows on the preview URL |
| Data is saved | A book logged on one device appears on a second device within 10 seconds |
| Secure | A request to `/api/books` without a session returns 401 and no rows |

## Turning a clause into a check (test first)
1. Pick the cheapest check that proves the clause: a unit test (one function), an integration test (a request against the running app), or a scripted walk (a browser clicking through the page).
2. Write it **before** the code. Run it. It must fail. If it passes before the code exists, the test is wrong or the segment is already done.
3. Build until it passes. Do not edit the test to make it pass; edit the code. If the clause itself was wrong, change the card with the owner, then re-freeze.
4. Keep it. Register it: `drydock regression add S3 "books api 401" "npm test -- books.test"`. Every later segment re-runs it.

## Guards get both directions
A rule that refuses something (a permission check, a validation, a filter) gets two tests: the bad case is refused **and** the good case next to it still works. A guard tested only against the hole that motivated it is not tested.

## The grade file
The grader writes `.drydock/runs/S3/graded.json`:
```json
{ "segment": "S3", "clauseVerdicts": [
  { "clauseId": "S3.1", "echoedText": "<the clause, word for word>", "met": true, "evidence": "npm test exited 0; output: ..." },
  { "clauseId": "S3.2", "echoedText": "<...>", "met": false, "evidence": "preview URL returns 500" } ] }
```
Then `drydock map grade S3` exits 0 only when every clause is echoed verbatim, marked met, and backed by evidence. Exit 3 means intact but not met. Exit 1 means the bar was dropped, softened, or widened.
