# Tiers: the method at three sizes

The method never changes. The machinery scales. Tiers exist because a separate evaluator is worth its cost only when the task sits beyond what the model does reliably on its own, and because multi-agent runs cost many times what a conversation costs. On a Pro plan a full panel can burn a week of usage in an afternoon.

| | **lite** | **standard** | **full** |
|---|---|---|---|
| Default when | plan is Pro, or unknown | plan is Max or Team, and the build holds no other people's data, logins, or money | plan is Max or Team, and the build has logins, other people's data, payments, or real users depending on it |
| Map review (after planning) | one map critic (1 agent) | 3-seat panel, 1 round (about 5 agents) | 5 to 7 seats, up to 2 rounds (up to 25 agents) |
| Per segment: scout | only when the segment touches existing code | always | always |
| Per segment: check | checker (1) | checker + honesty audit of the summary (2) | same |
| Per segment: prove | red team (1); the owner walks it | red team + walker (2) | same, plus the crew on CREW cards |
| The crew | not offered | offered on CREW cards with a cost warning | runs on CREW cards |
| Needs the Workflow tool | no (subagents only) | yes, for panels | yes |
| Agent calls per segment, roughly | 2 to 4 | 4 to 7 | 15 to 25 when the crew runs |

## Rules
- The tier lives in `.drydock/config.json` → `tier`. `/drydock:setup` sets it from the owner's plan; the owner can change it any time: `drydock config set tier standard`.
- A card's **Mode** can ask for more than the tier offers (a PANEL card on lite). Drydock then says what it would cost and offers the lighter equivalent. It never silently skips the mode and never silently upgrades.
- On Pro, Claude Code's own workflow size guideline defaults to fewer than 5 agents and dynamic workflows must be turned on in `/config`. Lite is built to fit that.
- The one-sentence rule beats the tier: a one-sentence change gets no plan and no panel at any tier.

## What each seat costs and what it catches (so you can decide)
| Piece | Catches | Cost |
|---|---|---|
| Checker | the builder's false "done"; gaps against the card | 1 agent, a few minutes |
| Red team | inputs the builder never tried; a rule that over-refuses the good case | 1 agent |
| Scout | changes that break neighbors the builder didn't look at | 1 agent, read-only |
| Walker | screens that render but do the wrong thing | 1 agent with a browser |
| Honesty audit | a summary that claims more than the evidence | 1 agent, no tools |
| Panel | wrong assumptions in the plan, before they become code | 3 to 25 agents |
| Crew | all of the above at once, with independent seats and deterministic gates | 15 to 25 agents, 1 to 3 hours |
