# ACT Caregiver App — AI Working Memory

This file is read automatically by Claude at the start of every session on this project.

---

## Debugging & QA Workflow

### Always Reproduce Locally First — Never Push a Diagnostic Change to Production

When a bug is reported by a live user (e.g., Shelly), the correct process is:

1. **Read `ARCHITECTURE.md` and `SYSTEM_PROMPT.md`** to understand the relevant system.
2. **Identify the suspected code path** — locate the file and function responsible.
3. **Reproduce the issue locally using test accounts** (see `TEST_ACCOUNTS.md`) against the local dev server (`npm run dev`).
4. **Use browser DevTools (Console + Network tabs)** to capture the actual error. Errors are often already logged via `console.error` in the existing code — no diagnostic code changes needed.
5. **Fix the root cause** once the real error is confirmed.
6. **Test the fix locally** with a test account before drafting a Worker Agent prompt.
7. **Only then** prepare the diff for review and production merge.

**Do NOT:**
- Push a code change to production just to surface an error message to a live user.
- Guess at root causes and ship speculative fixes without local reproduction.
- Ask Shelly or other live users to test unverified changes.

---

## Key Reference Files

| File | Purpose |
|---|---|
| `ARCHITECTURE.md` | Full system architecture — always review before any change |
| `SYSTEM_PROMPT.md` | Non-negotiable rules for all AI assistants on this codebase |
| `TEST_ACCOUNTS.md` | Local test credentials — never commit to Git |
| `WORKFLOW.md` | Development workflow and review loop |
