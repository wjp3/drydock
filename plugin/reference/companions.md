# Companion tools Drydock recommends

Offer each with its one-line why. Install only with the owner's yes. After installing, verify (`claude plugin list`, `claude mcp list`) and show the result. If a name below is not found in the marketplace Discover tab, skip it and say so; do not guess an alternative.

## Built into Claude Code (nothing to install)
| Tool | What it is for | Drydock uses it in |
|---|---|---|
| `/code-review` | reviews the current diff for bugs in a fresh context | check |
| `/verify` | builds and runs the app and checks a change against it | prove |
| `/goal` | a separate evaluator keeps the session working until a condition holds | build (unattended runs) |
| `/rewind` | restore code and conversation to an earlier point | when a build goes sideways |
| Plan mode (Shift+Tab) | read-only exploration before changes | plan |

## Plugins from the official marketplace (`/plugin`, Discover tab)
| Plugin | Why | Install |
|---|---|---|
| **context7** | current documentation for the libraries in use, so the builder stops guessing at APIs | `/plugin install context7@claude-plugins-official`; if absent, the hosted server: `claude mcp add --transport http context7 https://mcp.context7.com/mcp` |
| **typescript-lsp** (only for TypeScript stacks) | type errors shown after every edit | `/plugin install typescript-lsp@claude-plugins-official`, then install the language server it names |
| **frontend-design** | better-than-default screens | `/plugin install frontend-design@claude-plugins-official` |

## Services (MCP servers and CLIs)
| Service | Install | Notes |
|---|---|---|
| **GitHub** | the `gh` CLI from cli.github.com, then `gh auth login` | Anthropic recommends the CLI over an MCP for GitHub: cheaper on context |
| **Netlify** | `claude mcp add --transport http netlify https://netlify-mcp.netlify.app/mcp` and `npm install -g netlify-cli` then `netlify login` | the MCP signs in through the browser the first time |
| **Supabase** (only when the stack uses it) | `claude mcp add --transport http supabase "https://mcp.supabase.com/mcp?project_ref=<PROJECT_REF>"` | always scope to the project ref; add `&read_only=true` for any project holding real people's data; the first use signs in through the browser |
| **Playwright** (the live walk) | `claude mcp add playwright -- npx @playwright/mcp@latest` | lets the walker and the red team drive a real browser |

## Not recommended alongside Drydock
Other method plugins that also want to own planning and the definition of done (spec kits, agile-team packs, loop runners). Two methods in one session fight. Pick one.
