# Multi-Agent Execution Pipeline — WORKFLOW.md

This document defines the rules, conventions, and execution pipeline for all agents operating within this workspace.

---

## 1. Agent Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Orchestrator** | Decomposes tasks, delegates to subagents, aggregates results |
| **Research Agent** | Read-only exploration of codebase, docs, and web resources |
| **Implementation Agent** | Writes and edits source code, runs build/test commands |
| **Review Agent** | Validates output quality, catches regressions, provides feedback |
| **QA Agent** | Executes test suites, verifies behavior against acceptance criteria |

---

## 2. Pipeline Stages

```
[USER REQUEST]
      │
      ▼
[ORCHESTRATOR]
  ├─ Clarify intent if ambiguous
  ├─ Decompose into sub-tasks
  └─ Assign agents per stage
      │
      ▼
[RESEARCH PHASE]
  ├─ Research Agent surveys codebase & docs
  ├─ Returns findings to Orchestrator
  └─ No source code modifications allowed
      │
      ▼
[PLANNING PHASE]
  ├─ Orchestrator produces implementation_plan.md
  ├─ User reviews and approves plan
  └─ No code written until approval received
      │
      ▼
[IMPLEMENTATION PHASE]
  ├─ Implementation Agent executes approved plan
  ├─ Updates task.md with progress
  └─ Communicates blockers to Orchestrator immediately
      │
      ▼
[REVIEW PHASE]
  ├─ Review Agent inspects diff for correctness
  ├─ Flags regressions or missed requirements
  └─ Loops back to Implementation if issues found
      │
      ▼
[QA / VERIFICATION PHASE]
  ├─ QA Agent runs automated tests
  ├─ Reports pass/fail to Orchestrator
  └─ Produces walkthrough.md on success
      │
      ▼
[DONE — USER NOTIFIED]
```

---

## 3. Inter-Agent Communication Rules

1. **Message Format**: All inter-agent messages must include:
   - `from`: sending agent role
   - `to`: receiving agent role or conversation ID
   - `stage`: current pipeline stage
   - `content`: the message body

2. **Blocking vs. Non-blocking**: Agents must clearly indicate whether a message requires a response before the sender can continue.

3. **No Direct User Bypassing**: Subagents must not communicate directly with the user unless explicitly delegated by the Orchestrator.

4. **Single Source of Truth**: The Orchestrator's `task.md` artifact is the canonical record of task status. All agents must reference it.

---

## 4. Parallelism Rules

- **Allowed**: Concurrent execution of independent research tasks, independent file edits on disjoint files, and parallel QA checks.
- **Not Allowed**: Two agents editing the same file simultaneously. The Orchestrator must serialize such operations.
- **Branched Workspaces**: Use `workspace: branch` when an agent needs an isolated environment for experimental changes.

---

## 5. Error Handling

| Scenario | Action |
|---|---|
| Agent times out | Orchestrator retries once, then reports to user |
| Agent returns incomplete result | Orchestrator sends clarification message and awaits retry |
| Conflicting edits detected | Implementation Agent halts; Orchestrator resolves conflict manually |
| Test suite failure | QA Agent reports failures; pipeline loops back to Implementation |
| Unrecoverable error | Orchestrator kills subagents and escalates to user with full context |

---

## 6. Artifact Conventions

| Artifact | Owner | Purpose |
|---|---|---|
| `implementation_plan.md` | Orchestrator | Design doc; requires user approval before code is written |
| `task.md` | Implementation Agent | Live TODO tracker; updated throughout execution |
| `walkthrough.md` | QA / Orchestrator | Post-completion summary for user review |
| `WORKFLOW.md` | All agents (read-only) | This document; pipeline and collaboration rules |
| `TOKEN_SAFETY.md` | All agents (read-only) | Token budget and mitigation strategies |

---

## 7. Definition of Done

A task is considered **complete** only when:
- [ ] All `task.md` items are marked `[x]`
- [ ] All automated tests pass
- [ ] `walkthrough.md` has been created or updated
- [ ] The user has been notified with a concise summary
- [ ] No open blocking issues remain

---

*Last updated: 2026-05-23*
