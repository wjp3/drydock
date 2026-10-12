# Building a panel roster for this build

A seat is a **lens**, not a job title. Each seat reads the same exhibits and hunts for what its lens sees. Good rosters mix: people who will use it, people who could be harmed by it, people who have to run it, and one contrarian.

## Always consider these seats
| Seat | Focus | Hunt |
|---|---|---|
| **the-real-user** | reads the plan as the person who will use it on a bad day | what they will route around, what is missing that stops them, what confuses them on day one |
| **data-and-privacy** | whose data this holds, who can see what, what must never leak | any promise with no enforcement behind it; anything only hidden on screen instead of enforced |
| **what-breaks** | the engineer who has been paged at 3 a.m. | the step whose size is underestimated, the decision cheap now and expensive to reverse, the dependency that fails |
| **delivery-cadence** | is the order and size of segments honest for this owner's hours | the segment most likely to double, hidden work (accounts, emails, icons, onboarding) |
| **contrarian** | first principles | the top three ways this build dies; anything scoped that should not be built |

## Domain seats (add the ones the vision touches)
- Children or students use it → **minors-and-consent** (school policy, parent consent, what a child must never be able to do or see)
- Health, money, legal, or safety information → **duty-of-care** (what a wrong number or a stale record causes)
- Used on phones in the field → **offline-and-thumbs** (bad signal, one hand, bright sun)
- Public-facing or many users → **abuse-and-load** (spam, impersonation, the busy day)
- Run by a school or institution → **the-administrator** (who approves it, what IT will ask, who supports it when the owner is away)
- Accessibility matters (it always does; make it a seat when the users are not all like the owner) → **access** (screen readers, color, motor, reading level)

## Sizing by tier
- **lite**: no panel; one map critic that wears the-real-user, what-breaks, and contrarian at once.
- **standard**: 3 seats, 1 round. Pick the-real-user, what-breaks, and the most important domain seat.
- **full**: 5 to 7 seats, up to 2 rounds.

## Writing a seat
```
### the-real-user — ACTIVE
Focus: read VISION.md and BUILD-MAP.md as a fourth-grade teacher during the first week of school, with 26 students and 40 minutes.
Hunt: steps that take more than two taps; anything that assumes a laptop; what happens when a student logs the wrong book.
```
Keep the bench short. Seats on the bench are called when the build reaches their topic.
