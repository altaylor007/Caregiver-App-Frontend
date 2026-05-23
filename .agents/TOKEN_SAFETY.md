# Token Safety & Mitigation Rules — TOKEN_SAFETY.md

This document defines strategies to manage, conserve, and stay within token budgets across all agents operating in this multi-agent workspace.

---

## 1. Why Token Safety Matters

Large language models operate within a fixed context window. In a multi-agent system, each agent consumes tokens for:
- **Input context**: conversation history, file contents, tool results
- **Output generation**: plans, code, messages, artifacts
- **Tool calls**: arguments and responses

Exceeding budget leads to truncated context, lost history, degraded output quality, or hard failures. These rules mitigate that risk.

---

## 2. Token Budget Tiers

| Tier | Context Used | Action Required |
|---|---|---|
| 🟢 **Safe** | < 50% | Normal operation |
| 🟡 **Caution** | 50–75% | Begin summarizing; avoid large file reads |
| 🟠 **Warning** | 75–90% | Delegate to fresh subagent; minimize output verbosity |
| 🔴 **Critical** | > 90% | Immediately checkpoint state; hand off to new agent |

---

## 3. Context Management Rules

### 3.1 File Reading
- **Never read entire large files** unnecessarily. Use targeted line ranges (`StartLine`/`EndLine`).
- Read files **once** per agent session; cache the relevant content in a scratch artifact rather than re-reading.
- For files > 500 lines, summarize sections in a scratch note and reference the summary instead of raw content.

### 3.2 Search & Grep
- Use `grep_search` with targeted queries rather than broad directory scans.
- Filter by file type with `Includes` globs to reduce noise (e.g., `["*.ts", "*.tsx"]`).
- Limit results: if more than 20 matches are returned, refine the query before proceeding.

### 3.3 Tool Output
- Prefer structured, minimal tool outputs. Request summaries over full dumps.
- Truncate command output that exceeds 200 lines by piping through `head` or `tail`.
- Avoid running commands that produce verbose logs unless debugging requires it.

---

## 4. Agent Scope Rules

### 4.1 Research Agent
- Must **not** retain full file contents in context beyond the immediate task.
- Should produce a **concise findings summary** (≤ 300 tokens) and pass it to the Orchestrator.
- Must not spawn additional subagents without Orchestrator approval.

### 4.2 Implementation Agent
- Must read only the **files relevant to the current task** — not the entire codebase.
- Should use `multi_replace_file_content` for multiple edits rather than reading/writing full files.
- Must write intermediate progress to `task.md` so state can be recovered if context is lost.

### 4.3 Orchestrator
- Must summarize subagent responses before storing them in context.
- Must not carry full conversation transcripts — use `task.md` and `walkthrough.md` as external memory.
- Should kill idle subagents promptly to free resources.

---

## 5. Delegation Triggers

Delegate to a **fresh subagent** when any of the following occur:

| Trigger | Action |
|---|---|
| Context window > 75% full | Spawn fresh Implementation Agent with task summary |
| Transcript > 100 exchanges | Summarize and hand off to new Orchestrator session |
| Single file > 1,000 lines to process | Delegate file processing to dedicated Research Agent |
| More than 5 concurrent tool calls needed | Split across parallel subagents |
| Agent unresponsive for > 60 seconds | Kill and respawn with last known state from `task.md` |

---

## 6. Output Verbosity Guidelines

All agents must follow these verbosity rules in their responses:

| Output Type | Max Length |
|---|---|
| Agent-to-agent messages | ≤ 200 tokens |
| Task status updates | ≤ 100 tokens |
| Error reports | ≤ 150 tokens |
| User-facing summaries | ≤ 400 tokens |
| Implementation plans | No limit (artifact, not in-context) |
| Walkthroughs | No limit (artifact, not in-context) |

---

## 7. Checkpoint & Recovery Protocol

When an agent detects it is approaching context limits:

1. **Write current state** to `task.md` — mark in-progress items as `[/]` with a note on where execution stopped.
2. **Write a handoff note** to a scratch file: `/scratch/handoff_<timestamp>.md` containing:
   - Last completed step
   - Next planned step
   - Any open decisions or blockers
3. **Notify Orchestrator** with a brief message: `"Context limit approaching. State saved to task.md. Ready for handoff."`
4. **Orchestrator spawns a new agent** with the handoff note as context instead of the full history.

---

## 8. Prohibited Patterns

The following actions are **banned** due to excessive token consumption:

- ❌ Reading entire `node_modules` or build output directories
- ❌ Printing full stack traces longer than 50 lines without truncation
- ❌ Passing raw file contents (> 200 lines) in inter-agent messages
- ❌ Re-reading files that have already been read in the same session without a clear reason
- ❌ Running `npm install` or similar commands that produce hundreds of lines of output without `--silent` flag
- ❌ Storing full conversation history in working memory when a summary suffices

---

## 9. Best Practices Summary

| ✅ Do | ❌ Don't |
|---|---|
| Read targeted line ranges | Read entire large files |
| Summarize findings in artifacts | Keep raw output in context |
| Delegate early when context grows | Wait until context is exhausted |
| Use `grep_search` with filters | Run broad directory scans |
| Write state to `task.md` regularly | Rely solely on in-context memory |
| Kill idle subagents promptly | Leave orphaned agents running |

---

*Last updated: 2026-05-23*
