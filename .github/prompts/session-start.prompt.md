---
description: "Resume work on MoltChain from a new session. Loads all context: SKILL.md, deployment status, repo memory, strategy docs."
agent: "agent"
tools: [read, search, agent, todo]
argument-hint: "What should we work on today?"
---
Start of a new MoltChain development session. Before doing anything else, load full project context:

1. Read `SKILL.md` — the complete operational reference (1800+ lines)
2. Read `DEPLOYMENT_STATUS.md` — current deployment phase and task status
3. Read all files under `/memories/repo/` for accumulated knowledge from past sessions
4. Read `docs/strategy/PHASE2_AGENT_ECONOMY.md` and `docs/strategy/PHASE2_ACTIVATION_PLAN.md` for current phase priorities
5. Check `docs/foundation/ROADMAP.md` for overall timeline

After loading context, summarize:
- Current deployment phase and next pending tasks
- Any in-progress work from previous sessions
- Key blockers or decisions needed

Then ask what the user wants to work on today.
