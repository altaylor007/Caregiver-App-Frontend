# ACT Caregiver App — Agent Workflow

> **Last updated:** 2026-05-23  
> **Manager Agent:** Claude (Cowork)  
> **Worker Agent:** Antigravity (executes changes in `~/Documents/Caregiver app/`)

---

## Roles

### Manager (Claude)
- Reviews `ARCHITECTURE.md` and `SYSTEM_PROMPT.md` before every task
- Breaks requests into the **smallest possible isolated change**
- Drafts precise, file-specific prompts for the Worker
- Audits every diff before approving a merge
- Never writes or executes code directly in the codebase
- Issues GREEN LIGHT (safe to merge) or RED LIGHT (corrections required)

### Worker (Antigravity)
- Executes only what the Manager's prompt specifies
- Works only in `~/Documents/Caregiver app/`
- Returns a **compact diff** (no full file reprints)
- Runs `npm run build` before marking any task complete
- Never touches files outside the scope of the prompt

---

## The Review Loop

```
1. Amanda describes a feature or fix
       ↓
2. Manager reviews ARCHITECTURE.md + SYSTEM_PROMPT.md
       ↓
3. Manager breaks the request into the smallest single task
       ↓
4. Manager drafts a Worker prompt (file path + exact lines, no full files)
       ↓
5. Amanda sends prompt to Antigravity
       ↓
6. Antigravity returns a compact diff
       ↓
7. Manager audits the diff (logic, syntax, safety checks)
       ↓
8. GREEN LIGHT → Amanda merges into main files
   RED LIGHT  → Manager provides correction feedback → back to step 4
```

---

## Worker Prompt Template

Every prompt to Antigravity must include:

```
**File:** src/path/to/file.jsx (lines X–Y if relevant)

**Task:** [One sentence description]

**Instructions:**
1. [Specific, numbered steps]
2. ...

**Return:** Compact diff only (+ additions, - removals). No full file reprint.

**Hard stops — do not proceed if you find yourself:**
- Touching src/lib/supabase.js or src/lib/supabaseAdmin.js
- Modifying any file in supabase/migrations/
- Changing any function signature not listed above
- [Any task-specific stops]

**Before marking complete:** Run `npm run build` and confirm it passes.
```

---

## Manager Audit Checklist

For every diff returned by Antigravity, verify:

- [ ] All originally exported identifiers are still exported
- [ ] No function logic, signatures, or return values changed (unless that was the task)
- [ ] No auth files touched (`supabase.js`, `supabaseAdmin.js`, `AuthContext.jsx`)
- [ ] No migration files created or modified
- [ ] No new dependencies added without discussion
- [ ] No hardcoded keys, URLs, or credentials introduced
- [ ] `npm run build` confirmed passing

---

## Hard Rules (Non-Negotiable)

These apply to every task without exception:

1. **Never alter `storageKey: 'act-app-auth-token'`** in `src/lib/supabase.js` — changing this logs out all active users.
2. **Never create or modify migration files** in `supabase/migrations/` unless explicitly discussed.
3. **Never expose `VITE_SUPABASE_SERVICE_ROLE_KEY`** in any code path that ships to production.
4. **Never drop or modify** `public.responsibilities`, `public.users.acknowledged_responsibilities`, or any legacy table/column flagged in `SYSTEM_PROMPT.md`.
5. **Always run `npm run build`** before a task is considered done. A diff that breaks the build is a RED LIGHT regardless of logic correctness.

---

## Token Efficiency Rules

- Prompts reference **file paths and line numbers** — never paste full source files
- Diffs use `+/-` format — never request full file reprints
- One task = one file (unless the task explicitly requires coordinated changes)
- If a change touches more than 3 files, break it into separate tasks

---

## Test Accounts

### Structure

Four permanent test accounts cover every role and access path in the app. These accounts are created once and never deleted or recreated.

| Account | Role | `is_caregiver` | Purpose |
|---|---|---|---|
| `test.admin` | `admin` | `false` | Full admin access, Roles page, all admin pages |
| `test.manager` | `manager` | `false` | Manager access (no role assignment page) |
| `test.caregiver` | `caregiver` | `true` | Standard caregiver view — schedule, availability, messages, documents |
| `test.dualrole` | `manager` | `true` | Role-switcher behaviour — can toggle between manager and caregiver views |

Credentials are stored in `TEST_ACCOUNTS.md` (gitignored — never committed to GitHub).

### Hard Rules

- **Agents (Antigravity) must never reset a test account password.** If a test requires a known password, Amanda provides it manually.
- **Agents must never delete a test account.** These are permanent fixtures.
- **Agents must never use a test account as the target of a feature being built.** e.g. do not assign a test caregiver to a shift as part of a code task.
- **If a test scenario requires a throwaway account** (e.g. testing the new caregiver onboarding flow end-to-end), create a clearly named temporary account (`temp.test.YYYY-MM-DD`) and delete it after the test is complete.
- **Test accounts are on `main` data.** They share the same Supabase project as production. Do not use test accounts to insert junk data that would appear in production views for real users.

### Setting Up Test Accounts

When creating these accounts for the first time, use the `create-caregiver` Edge Function via `AdminCaregiversPage` (as any other caregiver would be created). Then:

1. Set `role` appropriately via `AdminRolesPage` for admin/manager accounts
2. Set `is_caregiver = true` for the dual-role account via the Supabase Dashboard
3. Set a known, stable password for each account and record it in `TEST_ACCOUNTS.md`
4. Set `requires_password_change = false` so test logins don't redirect to `/update-password`

---

## Deployment & Branch Strategy

All changes follow this path before reaching production users:

```
Worker makes change (local files)
       ↓
Manager issues GREEN LIGHT
       ↓
npm run build passes ✅
       ↓
Smoke test: manually verify the affected route/feature works as expected
       ↓
Commit & push to main branch (GitHub)
       ↓
Amanda confirms everything looks good on main
       ↓
Merge main → production branch (GitHub)
       ↓
Netlify auto-deploys immediately ⚠️
```

### Branch Rules

| Branch | Purpose |
|---|---|
| `main` | Active development. All Worker changes land here after Manager approval. Build and smoke test happen here. |
| `production` | Live app. Only receives merges from `main` once changes are verified working. |

- **Netlify auto-deploys the moment `production` is pushed to.** There is no confirmation step — merging to `production` is merging to live. Treat it accordingly.
- **Never commit directly to `production`.** All changes must pass through `main` first.
- **Nothing merges to `production` until it has been built and smoke-tested on `main`.** A passing build alone is not enough — the affected feature must be verified working in the browser.
- **Supabase Edge Functions are deployed separately.** If a task touches `supabase/functions/`, Antigravity must note this explicitly. Those functions require a separate `supabase functions deploy <name>` command and are not covered by `npm run build`.
- **Database migrations are never auto-applied.** Any `.sql` changes must be reviewed by Amanda and applied manually via the Supabase Dashboard or CLI — never by the Worker autonomously.
- **When in doubt, don't merge to production.** If a smoke test reveals unexpected behavior, the issue goes back through the Review Loop before anything reaches the `production` branch.

---

## Folder Structure

```
~/Documents/Claude/Projects/Caregiver app 2/   ← Manager workspace
    ARCHITECTURE.md
    SYSTEM_PROMPT.md
    WORKFLOW.md                                 ← This file

~/Documents/Caregiver app/                     ← Worker workspace (codebase)
    .agents/
        WORKFLOW.md                             ← Copy of this file for Antigravity reference
    src/
    supabase/
    ...
```
