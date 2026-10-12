# Where the method comes from

Drydock packages a working build protocol developed across several real products, checked against the public methods on 2026-10-11. Everything below was read in full on that date.

## Anthropic
- Claude Code best practices: https://code.claude.com/docs/en/best-practices (verification, plan mode, "let Claude interview you", the Writer/Reviewer pattern, the adversarial review step, context management)
- `/goal`: https://code.claude.com/docs/en/goal (a separate evaluator decides completion after every turn)
- Dynamic workflows: https://code.claude.com/docs/en/workflows (independent agents adversarially verify each other; cost and size guidance)
- Skills and `/verify`: https://code.claude.com/docs/en/skills
- Effective harnesses for long-running agents (2025-11-26): https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents (feature list agents may only flip to passing after testing; progress files; one feature per session)
- Harness design for long-running application development (2026-03-24): https://www.anthropic.com/engineering/harness-design-long-running-apps (planner, generator, evaluator; "agents reliably skew positive when grading their own work"; "every component in a harness encodes an assumption about what the model can't do on its own")
- Building effective agents: https://www.anthropic.com/engineering/building-effective-agents (start simple; evaluator-optimizer when criteria are clear)
- How we built our multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system (multi-agent runs use about 15x the tokens of chat)

## Public methods compared
- Superpowers (obra): https://github.com/obra/superpowers (brainstorm, plan, test-driven development, verification before completion, two-stage review)
- GitHub Spec Kit: https://github.com/github/spec-kit (constitution once per project; specify, plan, tasks, implement, converge)
- BMAD-METHOD: https://github.com/bmad-code-org/BMAD-METHOD (planning agents, one story at a time, small changes go straight to build)
- Anthropic feature-dev plugin: https://github.com/anthropics/claude-plugins-official/tree/main/plugins/feature-dev (several architects with different lenses; several reviewers)
- HumanLayer, Advanced Context Engineering for Coding Agents: https://github.com/humanlayer/advanced-context-engineering-for-coding-agents (research, plan, implement; review the plan, not the code)
- Addy Osmani, My LLM coding workflow going into 2026: https://addyosmani.com/blog/ai-coding-workflow/ and Agent harness engineering: https://addyosmani.com/blog/agent-harness-engineering/
- The Ralph loop, a case study: https://orbi.build/blog/ralph-loop-claude-code (28 passing tests, and a fresh reviewer still said do not merge)
- Thoughtworks Technology Radar vol. 34 (April 2026): https://www.thoughtworks.com/content/dam/thoughtworks/documents/radar/2026/04/tr_technology_radar_vol_34_en.pdf

## What Drydock adds that the public methods lack
A different model family checks the builder. The summary the owner reads is audited against receipts before it is relayed. Every control traces to a specific failure and carries a retirement rule.
