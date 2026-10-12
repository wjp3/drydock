---
name: "status"
description: "Shows where the build stands: segments green, the active segment, last test, gate state, and the next buildable segment. Use when the owner asks \"where are we\" or \"what's next\"."
---

Run:
```
node "${CLAUDE_PLUGIN_ROOT}/scripts/drydock.mjs" status
```
Present the output in the owner's register (see `${CLAUDE_PLUGIN_ROOT}/reference/voice.md`): a short table of segments with their status, then one line for the active segment and the last test, then **one recommended next move**. Do not start any work. If there is no map yet, say so and recommend `/drydock:plan`.
