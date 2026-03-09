---
description: "Save session progress and update all tracking documents. Use at the end of a work session to preserve context for the next one."
agent: "agent"
tools: [read, edit, search, todo]
argument-hint: "Brief summary of what was accomplished this session"
---
End-of-session checkpoint. Save all progress and context:

1. **Update `DEPLOYMENT_STATUS.md`** — Mark any completed deployment tasks, add session log entry with date and summary.

2. **Update repo memory** — Save key learnings, patterns discovered, or gotchas to `/memories/repo/`.

3. **Check for documentation drift** — If any code was changed this session, verify the corresponding docs (SKILL.md, README.md, relevant docs/ files) still match reality.

4. **Summarize** — Provide a brief summary of:
   - What was completed
   - What's in progress
   - What's blocked or needs decision
   - Recommended next steps for the following session
