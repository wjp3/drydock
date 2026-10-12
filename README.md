# Drydock

**A way of building things with Claude Code that stops the four ways builds fail.** You describe what you want. Drydock interviews you, writes a map of small segments with a test for each, builds one segment at a time, has a separate check review the work, attacks it, walks it like a person would, and stops to show you the evidence. Nothing goes live without your go.

Drydock is a Claude Code plugin plus a plain-English playbook. It is sized to your plan: a light version by default, heavier checks when the build earns them.

## The four failures it exists to stop
| You have seen this | What Drydock does instead |
|---|---|
| You give it an idea and it starts coding with no plan. | An interview, then `VISION.md` and `BUILD-MAP.md`: segments in order, each with a binary exit test. |
| Every fix breaks something else. | Tests before code. A look at what else touches the changed code. Every earlier segment's checks re-run before any new "done". A commit at every green. |
| A new session forgets what was built or re-decides things. | Memory in files: `STATE.md`, `DECIDED.md`, handoffs, snapshots before compaction. One segment per session. |
| It says "done" and it isn't. | The exit test is frozen word for word. A fresh reviewer on a different model re-runs the tests and grades each clause. A red team attacks. The running app is walked. The summary you read is audited against the evidence. |

## Install (about two minutes, no terminal needed for the plugin)
You need a paid Claude plan (Pro or above), the [Claude desktop app](https://claude.com/download) or Claude Code, plus [Node.js](https://nodejs.org) 20 or newer, [git](https://git-scm.com), and the [GitHub CLI](https://cli.github.com) for the apps you will build. Mac, Windows, or Linux.

**Easiest: add it from the claude.ai website.** Open [claude.ai/customize/plugins](https://claude.ai/customize/plugins) (or **Customize > Plugins** in the desktop app), choose **Add > Add marketplace**, type `wjp3/drydock`, and add it. Drydock is saved to your account and appears in Claude Code the next time you start a session. No typing in a terminal.

**Or, in a Claude Code session**, type these two lines:
```
/plugin marketplace add wjp3/drydock
/plugin install drydock@drydock
```

**No GitHub access?** On the same Plugins page choose **Add > Upload plugin** and pick `dist/drydock-plugin.zip`. (For a Claude Code local install, unzip `dist/drydock-marketplace.zip` somewhere permanent and run `/plugin marketplace add <path to the unzipped folder>`.)

Then open the folder where your project will live (an empty folder is fine) and type:
```
/drydock:setup
```

## Setting it up for someone who is not technical
A one-time sit-down, in person or by screen share with control, leaves them never needing a terminal again. `install/` holds a one-line installer for Mac and for Windows (git, Node, GitHub's tool, Claude Code, the plugin, a Builds folder, sign-ins in the browser) and `dist/Drydock-Setup-Checklist.pdf` is the two-page checklist for the person helping. Mac, in Terminal:
```
bash <(curl -fsSL https://raw.githubusercontent.com/wjp3/drydock/v0.1.0/install/Install-Drydock.command)
```
Windows, in PowerShell run as administrator:
```
irm https://raw.githubusercontent.com/wjp3/drydock/v0.1.0/install/Install-Drydock.ps1 | iex
```

## Your first hour
1. `/drydock:setup`: checks your computer, asks four questions, creates the memory files, offers the companion tools.
2. `/drydock:plan`: the interview. Answer in your own words. You get `VISION.md` and `BUILD-MAP.md`, reviewed by lenses you do not have.
3. `/drydock:build S0`: the first segment is always "the skeleton is live": an empty app with its name at a web address, a passing test, code on GitHub. It proves the whole path before any feature exists.
4. Try it. Say **next**. Each segment ends with a stop: what you can now do, the exit test clause by clause with evidence, what the separate check found, what is not proven.
5. `/drydock:handoff` when you stop for the day. `/drydock:wake` when you come back.

## The five verbs
| Verb | Command | What happens |
|---|---|---|
| Plan | `/drydock:plan` | interview → vision → map → map review |
| Build | `/drydock:build S3` | freeze the exit test → failing tests → build → green → commit → check → prove → stop |
| Check | `/drydock:check` | earlier tests re-run; a fresh reviewer reads the change against its card |
| Prove | `/drydock:prove` | the red team attacks; the running app is walked; a proof sheet is filed |
| Remember | `/drydock:wake`, `/drydock:handoff`, `/drydock:status` | where we are, what is settled, what is next |

Also: `/drydock:ship` (preview, then live on your go), `/drydock:panel` (several expert lenses on a decision), `/drydock:crew` (the full build crew, full tier only), `/drydock:help`.

## Tiers and cost
| Tier | Default for | What runs per segment |
|---|---|---|
| lite | Pro, or unknown plan | one checker, one red team pass, your own walk |
| standard | Max or Team | checker, red team, walker, honesty audit; 3-seat panels on contested decisions |
| full | Max or Team, with logins, other people's data, or money | all of the above plus the crew on marked segments |

Multi-agent runs cost many times what a conversation costs. Drydock tells you before any run that is large and never upgrades the tier on its own. Change it any time: `node <plugin>/scripts/drydock.mjs config set tier standard`.

## What Drydock will not do
Create accounts or type passwords for you. Push, deploy, or publish without your explicit yes for that exact step. Call anything done without the command and its output, or a screenshot. Keep going after it is stuck three times instead of telling you.

## The playbook
`dist/Drydock-Playbook.pdf` is the plain-English guide: a two-page quickstart, then about twenty pages on why builds break, how each verb works, what a good exit test looks like, how to read a stop message, what to do when things go wrong. Source in `playbook/`.

## Where the method comes from
A working build protocol developed across several real products, checked on 2026-10-11 against Anthropic's published guidance and research and the main public methods. `plugin/reference/sources.md` lists everything read. Drydock adds three things the public methods lack: a different model family checks the builder, the summary you read is audited against receipts first, and every control traces to a specific failure with a rule for retiring it.

## License
MIT. Copyright 2026 wjp3.
