# ACT Caregiver App — AI System Prompt

This document is the single source of truth for any AI assistant (Cursor, Antigravity, GitHub Copilot, Claude, etc.) working on this codebase. Read it fully before making any changes.

---

## Project Identity

You are working on the **ACT Caregiver App** — a mobile-first React PWA for a home-care agency. It manages caregiver scheduling, team communications, payroll hours tracking, document distribution, and availability management.

- **Frontend:** React 19 + Vite 7 + React Router DOM 7, Vanilla CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions)
- **SMS:** Twilio (via Supabase Edge Functions)
- **Deployment:** Supabase cloud project (no custom server)

---

## Non-Negotiable Rules

### 1. Never Break Existing Logins
- The Supabase client is initialized with `storageKey: 'act-app-auth-token'` in `src/lib/supabase.js`.
- **Do not change this key.** Every currently logged-in user has their JWT stored under this key. Changing it will log out all users.

### 2. Never Self-Migrate
- Do not create new Supabase migration files unless explicitly instructed.
- All schema changes must be discussed with the developer before any `.sql` file is created.
- Ad-hoc SQL changes go to `supabase/` root. Versioned, production-safe changes go to `supabase/migrations/` with timestamps in `YYYYMMDDHHMMSS_description.sql` format.

### 3. Never Commit the Service Role Key
- `VITE_SUPABASE_SERVICE_ROLE_KEY` is for **local development only**.
- Never reference it in code that ships to production.
- Production admin operations must go through Supabase Edge Functions (Deno), which receive the key via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` (auto-injected by Supabase).

### 4. Preserve Historical Data
- The `public.responsibilities` table is legacy — do not drop it. It was replaced by `public.documents` but kept for rollback safety.
- The `public.users.acknowledged_responsibilities` column is legacy — do not remove it.
- The `public.unavailability` table was renamed from `public.time_off_requests` — its FK constraint is still named `time_off_requests_user_id_fkey`.

### 5. Respect the Role Hierarchy
- `role` values in `public.users` must be one of: `'admin'`, `'manager'`, `'caregiver'`.
- Only users with `role = 'admin'` can change the `role` column on any user (enforced by DB trigger `enforce_admin_role_assignment_trigger`).
- Managers have the same CRUD access as admins **except** they cannot promote/demote roles.
- The `is_caregiver` flag (`boolean`) is separate from `role` and enables dual-role mode for admins/managers who also work shifts.

### 6. No Self-Registration
- Caregivers cannot create their own accounts.
- New users are created by admins only via the `create-caregiver` Edge Function.
- All new accounts are created with `requires_password_change: true`.

### 7. All FK Constraints Use ON DELETE CASCADE
- Deleting a user cascades to: shifts, messages, availability, availability_requests, availability_responses, shift_trades (both FK columns), unavailability, sms_logs, document_acknowledgments, notifications, message_reactions.
- Never add a new FK without `ON DELETE CASCADE` unless there is a deliberate business reason discussed with the developer.

---

## Core Architecture Summary

```
src/
├── App.jsx            ← All route definitions (React Router DOM v7)
├── contexts/
│   ├── AuthContext.jsx ← Session, profile, role state. useAuth() hook.
│   └── ThemeContext.jsx ← Light/dark theme (localStorage key: 'app-theme')
├── lib/
│   ├── supabase.js         ← Anon Supabase client (storageKey: 'act-app-auth-token')
│   ├── supabaseAdmin.js    ← Service-role client (local dev only)
│   ├── database.types.ts   ← Auto-generated TypeScript types for all tables
│   └── timeUtils.js        ← Date/time helpers
├── components/
│   └── AdminRoute.jsx      ← Guard: redirects non-admins to /
├── layouts/
│   └── MainLayout.jsx      ← Header (logo, role switcher, notifications bell, sign out, theme),
│                             bottom mobile nav (switches admin vs caregiver links based on isAdmin)
└── pages/
    ├── [Admin pages]       ← Prefixed AdminXxx, only shown when isAdmin = true
    └── [Caregiver pages]   ← Shown to all authenticated users
```

---

## Authentication Context API

`useAuth()` returns:

| Property | Type | Description |
|---|---|---|
| `session` | `Session \| null` | Raw Supabase session object |
| `user` | `User \| null` | Raw Supabase auth user |
| `profile` | `object \| null` | Row from `public.users` (all columns) |
| `isLoading` | `boolean` | True during initial session hydration |
| `activeRole` | `'admin' \| 'manager' \| 'caregiver' \| null` | Currently viewed role |
| `setActiveRole` | `function` | Switch viewed role (dual-role users) |
| `isAdmin` | `boolean` | `activeRole === 'admin' \|\| activeRole === 'manager'` |
| `isSuperAdmin` | `boolean` | `profile?.role === 'admin'` |
| `signOut` | `function` | Clears role + signs out + navigates |

**Important:** `isAdmin` is `true` for both `admin` and `manager` roles. Use `isSuperAdmin` to gate features exclusive to `admin`.

---

## Database Tables Quick Reference

| Table | Purpose |
|---|---|
| `public.users` | User profiles (extends `auth.users` 1:1 on `id`) |
| `public.shifts` | Work shifts (assigned or open) |
| `public.shift_templates` | Reusable shift presets (time-only, no date) |
| `public.shift_trades` | Peer-to-peer trade requests + SMS code |
| `public.availability` | Simple daily availability per caregiver |
| `public.availability_requests` | Admin requests for caregivers to fill availability |
| `public.availability_responses` | Caregiver responses to those requests |
| `public.unavailability` | Blocks of unavailability (renamed from `time_off_requests`) |
| `public.messages` | Team message board posts (with @mentions, image_url) |
| `public.message_topics` | Message board channels/topics |
| `public.message_reactions` | Emoji reactions on messages |
| `public.notifications` | In-app notifications (mentions, documents) |
| `public.documents` | Admin-uploaded files (PDF, images) |
| `public.document_acknowledgments` | Tracks who acknowledged which document |
| `public.responsibilities` | **Legacy** — superseded by documents |
| `public.payroll_reports` | Saved payroll snapshots (JSONB report_data) |
| `public.sms_logs` | Audit log of all inbound/outbound SMS |

---

## Key Columns to Always Include in Queries

When querying `public.users`, the most commonly needed columns are:
```
id, email, full_name, first_name, last_name, role, is_caregiver,
status, payroll_enabled, sms_enabled, sms_only_mentions, phone,
avatar_url, requires_password_change, last_read_messages_at
```

When querying `public.shifts`, always include:
```
id, title, date, start_time, end_time, assigned_to, custom_assigned_name,
is_open, trade_notes, created_at
```

---

## Edge Functions

| Function | HTTP Method | Purpose |
|---|---|---|
| `create-caregiver` | POST | Admin creates new caregiver (auth + profile) |
| `reset-password` | POST | Admin resets caregiver password + sets `requires_password_change = true` |
| `update-user-contact` | POST | Admin updates caregiver email/phone/password |
| `send-sms` | POST | Send SMS via Twilio (by `userId` or raw `to` phone) |
| `handle-sms-reply` | POST | Twilio webhook for inbound SMS (shift trade acceptance) |

**All Edge Functions use Deno.** Import from `jsr:@supabase/supabase-js@2` or `https://deno.land/std/`.

---

## Frontend Routing Summary

### Public Routes
| Path | Component |
|---|---|
| `/welcome` | `LandingPage` |
| `/auth` | `AuthPage` |
| `/terms` | `TermsOfServicePage` |
| `/privacy` | `PrivacyPolicyPage` |
| `/opt-in` | `OptInExamplePage` |

### Protected Routes (any authenticated user)
| Path | Component |
|---|---|
| `/update-password` | `UpdatePasswordPage` |
| `/` | `AdminDashboardPage` (if isAdmin) OR `DashboardPage` |
| `/schedule` | `SchedulePage` |
| `/availability` | `AvailabilityPage` |
| `/messages` | `MessagesPage` |
| `/documents` | `CaregiverDocumentsPage` |
| `/directory` | `CaregiverDirectoryPage` |
| `/profile` | `ProfilePage` |

### Admin/Manager Only Routes (wrapped in `<AdminRoute>`)
| Path | Component |
|---|---|
| `/admin/caregivers` | `AdminCaregiversPage` |
| `/admin/documents` | `AdminDocumentsPage` |
| `/admin/schedule` | `AdminSchedulePage` |
| `/admin/reports` | `AdminReportsPage` |
| `/admin/payroll` | `AdminPayrollPage` |
| `/admin/roles` | `AdminRolesPage` |

---

## Storage Buckets

| Bucket | Public | Max Size | Allowed Types |
|---|---|---|---|
| `avatars` | Yes | Default | Any image |
| `documents` | Yes | Default | Any |
| `message-attachments` | Yes | 5 MB | JPEG, PNG, WebP, GIF, HEIC |

---

## SMS Integration Pattern

```
New message posted → DB trigger → net.http_post → send-sms Edge Fn → Twilio API
Caregiver replies "YES CODE" → Twilio webhook → handle-sms-reply Edge Fn → shift_trades updated
```

**SMS preferences per user:**
- `sms_enabled = false` → no SMS
- `sms_enabled = true`, `sms_only_mentions = false` → SMS for all messages
- `sms_enabled = true`, `sms_only_mentions = true` → SMS only for @mentions

---

## CSS / Styling Rules

- All styles are in `src/index.css` using CSS custom properties (design tokens).
- Use `var(--token-name)` throughout components — no hardcoded colors.
- Dark mode is applied by setting `data-theme="dark"` on `<html>` (via `ThemeContext`).
- Do not introduce Tailwind, inline styles (except rare layout exceptions), or external CSS frameworks.
- Class naming convention uses BEM-lite: `.card`, `.btn`, `.btn-primary`, `.form-input`, `.nav-item`, `.text-sm`, `.text-neutral-500` etc.

---

## Adding New Features — Checklist

1. **New DB table:**
   - Add migration file in `supabase/migrations/` with timestamp prefix
   - Add RLS policies (all tables must have RLS enabled)
   - Add ON DELETE CASCADE FK if referencing `users`
   - Update `src/lib/database.types.ts` with the new table type

2. **New page:**
   - Create `src/pages/MyNewPage.jsx`
   - Add route in `src/App.jsx`
   - If admin-only: wrap in `<AdminRoute>`
   - Add nav link in `MainLayout.jsx` if it needs a nav item

3. **New Edge Function:**
   - Create `supabase/functions/my-function/index.ts`
   - Add CORS headers and handle OPTIONS method
   - Validate Authorization header
   - Use `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` — never hardcode keys
   - Log errors to console (visible in Supabase Edge Function logs)

4. **Admin-only operations:**
   - Use the `create-caregiver`, `reset-password`, or `update-user-contact` Edge Functions
   - Never use `supabaseAdmin.js` in production code paths

---

## Common Gotchas

| Gotcha | Explanation |
|---|---|
| `isAdmin` is true for managers | Both `admin` and `manager` roles map to `isAdmin = true`. Use `isSuperAdmin` for admin-only UI. |
| `is_caregiver` is separate from `role` | An admin can be on the caregiver roster without changing their `role`. |
| `unavailability` FK is named `time_off_requests_user_id_fkey` | The table was renamed but the constraint name was not updated. |
| `public.users` INSERT via trigger only | The `on_auth_user_created` trigger creates the `public.users` row. Never INSERT directly into `public.users` for new users. |
| Edge Function retry loop | `create-caregiver` retries up to 20 times with 500ms delay to wait for the trigger to create the profile row before updating it. Do not remove this loop. |
| `sms_code` auto-generated | `shift_trades.sms_code` is auto-generated by the `trigger_generate_sms_code` trigger on INSERT. Do not set it manually. |
| `payroll_reports.end_date` is UNIQUE | Only one payroll report can exist per period end date. |
| SMS trigger placeholders | The DB-level SMS trigger functions contain `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_SERVICE_ROLE_KEY` placeholders. These must be replaced with real values for SMS triggers to work. |
| Phone column is `phone` not `phone_number` | `phone_number` was migrated to `phone` in 2026-03-28 and the column dropped. |

---

## Environment Variables

### Frontend (`.env`)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Local dev only, never commit
```

### Edge Functions (Supabase Secrets)
```
SUPABASE_URL                ← Auto-injected by Supabase runtime
SUPABASE_ANON_KEY           ← Auto-injected by Supabase runtime
SUPABASE_SERVICE_ROLE_KEY   ← Auto-injected by Supabase runtime
TWILIO_ACCOUNT_SID          ← Set via Supabase Dashboard → Edge Functions → Secrets
TWILIO_AUTH_TOKEN           ← Set via Supabase Dashboard → Edge Functions → Secrets
TWILIO_PHONE_NUMBER         ← Set via Supabase Dashboard → Edge Functions → Secrets (E.164 format)
```

---

## Full Architecture Reference

For the full database ERD, complete RLS policy list, migration history, and detailed authentication flow diagrams, see [ARCHITECTURE.md](./ARCHITECTURE.md) in the project root.
