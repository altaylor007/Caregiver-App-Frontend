# ACT Caregiver App — Architecture Document

> **Status:** Living document. Last updated: 2026-05-23  
> **Codebase:** `/Users/lenke/Documents/Caregiver app`  
> **Repo:** `altaylor007/Caregiver-App-Frontend`

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [File Structure](#3-file-structure)
4. [Database Schema](#4-database-schema)
5. [Authentication Flow](#5-authentication-flow)
6. [Role-Based Access Control (RBAC)](#6-role-based-access-control-rbac)
7. [Row-Level Security (RLS) Policies](#7-row-level-security-rls-policies)
8. [API — Supabase Edge Functions](#8-api--supabase-edge-functions)
9. [Database Stored Functions & Triggers](#9-database-stored-functions--triggers)
10. [Storage Buckets](#10-storage-buckets)
11. [Real-Time Subscriptions](#11-real-time-subscriptions)
12. [SMS Integration (Twilio)](#12-sms-integration-twilio)
13. [Frontend Routing](#13-frontend-routing)
14. [Environment Variables](#14-environment-variables)
15. [Database Migration History](#15-database-migration-history)
16. [Key Design Decisions & Guard Rails](#16-key-design-decisions--guard-rails)

---

## 1. System Overview

The **ACT Caregiver App** is a mobile-first Progressive Web Application (PWA) used by a home-care agency to manage caregiver scheduling, availability, team communications, payroll tracking, and document distribution. It is a **single-page React application** backed entirely by **Supabase** (PostgreSQL + Auth + Storage + Edge Functions + Realtime).

```
Browser (React SPA)
       │
       │  HTTPS
       ▼
 Supabase Project (Cloud)
 ┌─────────────────────────────────────────────────┐
 │  Auth (email/password)                          │
 │  PostgREST API  ──►  PostgreSQL (public schema) │
 │  Realtime (WebSockets)                          │
 │  Storage (S3-compatible buckets)                │
 │  Edge Functions (Deno runtime)                  │
 └─────────────────────────────────────────────────┘
       │
       │  Twilio REST API (outbound/inbound SMS)
       ▼
  Twilio
```

---

## 2. Technology Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Frontend Framework | React | 19.x |
| Build Tool | Vite | 7.x with `@vitejs/plugin-react` |
| Routing | React Router DOM | 7.x |
| UI Icons | Lucide React | 0.575.x |
| Date Handling | date-fns + date-fns-tz | 4.x / 3.x |
| Backend / BaaS | Supabase | @supabase/supabase-js 2.98+ |
| Database | PostgreSQL (via Supabase) | 14.1 (PostgREST) |
| Auth | Supabase Auth (email/password) | Built-in |
| Realtime | Supabase Realtime (WebSocket) | Built-in |
| Object Storage | Supabase Storage | S3-compatible |
| Edge Functions | Supabase Edge Functions (Deno) | Per-function Deno runtime |
| SMS Provider | Twilio | REST API v2010-04-01 |
| Styling | Vanilla CSS (custom design tokens) | `src/index.css` |
| Type Definitions | TypeScript (`.types.ts` only) | `src/lib/database.types.ts` |
| Linter | ESLint 9.x | `eslint.config.js` |

---

## 3. File Structure

```
Caregiver app/
├── index.html                        # Vite HTML entry point
├── vite.config.js                    # Vite config (React plugin)
├── package.json                      # Dependencies & npm scripts
├── eslint.config.js                  # ESLint configuration
├── .env                              # Local env vars (gitignored)
├── .gitignore
├── README.md
│
├── public/
│   └── tulip.svg                     # App logo
│
├── src/
│   ├── main.jsx                      # React DOM entry point
│   ├── App.jsx                       # Root component, all route definitions
│   ├── index.css                     # Global CSS, design tokens, dark-mode vars
│   │
│   ├── contexts/
│   │   ├── AuthContext.jsx           # Session, profile, role state + signOut
│   │   └── ThemeContext.jsx          # Light/dark theme toggle (localStorage)
│   │
│   ├── lib/
│   │   ├── supabase.js               # Supabase anon client (storageKey: 'act-app-auth-token')
│   │   ├── supabaseAdmin.js          # Supabase service-role client (local dev only)
│   │   ├── database.types.ts         # Auto-generated TypeScript types for all tables
│   │   └── timeUtils.js              # Shared time/date utility functions
│   │
│   ├── components/
│   │   └── AdminRoute.jsx            # Route guard: redirects non-admins to /
│   │
│   ├── layouts/
│   │   └── MainLayout.jsx            # Persistent header + bottom nav, notification bell,
│   │                                 # unread message dot, role-switcher dropdown
│   │
│   └── pages/
│       ├── LandingPage.jsx           # Public marketing/welcome page (/welcome)
│       ├── AuthPage.jsx              # Login form (/auth)
│       ├── UpdatePasswordPage.jsx    # Force-change password after admin reset
│       ├── TermsOfServicePage.jsx    # Static ToS (/terms)
│       ├── PrivacyPolicyPage.jsx     # Static privacy policy (/privacy)
│       ├── OptInExamplePage.jsx      # SMS opt-in sample page (/opt-in)
│       │
│       ├── DashboardPage.jsx         # Caregiver home: upcoming shifts, responsibilities
│       ├── SchedulePage.jsx          # Caregiver calendar view + open shift claiming
│       ├── AvailabilityPage.jsx      # Caregiver availability responses + unavailability blocks
│       ├── MessagesPage.jsx          # Team message board (topics, reactions, @mentions, images)
│       ├── CaregiverDocumentsPage.jsx # Caregiver: read & acknowledge documents
│       ├── CaregiverDirectoryPage.jsx # Caregiver phone/email directory
│       ├── ProfilePage.jsx           # Profile edit (name, avatar upload, SMS prefs)
│       │
│       ├── AdminDashboardPage.jsx    # Admin home overview
│       ├── AdminSchedulePage.jsx     # Admin full schedule CRUD, shift templates, shift trades
│       ├── AdminCaregiversPage.jsx   # Admin: create/edit caregivers, payroll & status toggles
│       ├── AdminDocumentsPage.jsx    # Admin: upload/manage documents
│       ├── AdminPayrollPage.jsx      # Admin: hours reporting, payroll report generation/export
│       ├── AdminReportsPage.jsx      # Admin: analytics & metrics
│       └── AdminRolesPage.jsx        # Super-admin only: assign admin/manager/caregiver roles
│
├── supabase/
│   ├── config.toml                   # Supabase CLI local project config
│   ├── supabase_local_push.sh        # Helper script for local migration push
│   │
│   ├── migrations/                   # Versioned, ordered migrations (applied to production)
│   │   ├── 20231001000000_initial_schema.sql
│   │   ├── 20260303000000_add_requires_password_change.sql
│   │   ├── 20260307172033_add_first_last_name.sql
│   │   ├── 20260308000000_add_is_caregiver.sql
│   │   ├── 20260313171738_add_on_delete_cascade.sql
│   │   ├── 20260327175816_update_availability.sql
│   │   ├── 20260327180816_claim_open_shift.sql
│   │   ├── 20260328113526_consolidate_phone_number.sql
│   │   ├── 20260424125900_add_message_images.sql
│   │   └── 20260523000000_create_message_sms_trigger.sql
│   │
│   ├── functions/                    # Supabase Edge Functions (Deno)
│   │   ├── _shared/
│   │   │   └── supabase.ts           # Shared Supabase client for edge functions
│   │   ├── create-caregiver/
│   │   │   └── index.ts              # Create auth + profile row for new caregiver
│   │   ├── reset-password/
│   │   │   └── index.ts              # Admin-initiated password reset + flag
│   │   ├── send-sms/
│   │   │   └── index.ts              # Send SMS via Twilio (by userId or direct phone)
│   │   ├── handle-sms-reply/
│   │   │   └── index.ts              # Twilio webhook: process inbound SMS (YES to accept trade)
│   │   └── update-user-contact/
│   │       └── index.ts              # Admin updates email/phone/password in auth + profile
│   │
│   └── [*.sql files]                 # Ad-hoc SQL scripts run manually in Supabase SQL Editor
│                                     # (see §15 for full list)
│
└── [test*.js / check*.js / fix*.js]  # Local Node.js diagnostic scripts (not production code)
```

---

## 4. Database Schema

All tables live in the **`public`** schema. Supabase Auth tables live in `auth` (managed by Supabase, not edited directly).

### 4.1 `public.users`

The primary user profile table. **Extends `auth.users`** — every row is linked 1:1 to an `auth.users` row via `id`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users(id)` ON DELETE CASCADE | Matches Supabase Auth UID |
| `email` | `text` | NOT NULL | Synced from auth |
| `role` | `text` | NOT NULL, DEFAULT `'caregiver'`, CHECK in (`'admin'`, `'manager'`, `'caregiver'`) | Enforced by DB trigger |
| `full_name` | `text` | nullable | Display name |
| `first_name` | `text` | nullable | Added 2026-03-07 |
| `last_name` | `text` | nullable | Added 2026-03-07 |
| `phone` | `text` | nullable | Consolidated from `phone_number` (2026-03-28) |
| `avatar_url` | `text` | nullable | Supabase Storage public URL |
| `status` | `text` | nullable, DEFAULT `'active'` | `'active'` or `'inactive'` |
| `payroll_enabled` | `boolean` | NOT NULL, DEFAULT `false` | Whether caregiver appears in payroll |
| `payroll_report_contact` | `boolean` | nullable | Receives payroll report emails |
| `sms_enabled` | `boolean` | nullable, DEFAULT `false` | Master SMS opt-in |
| `sms_only_mentions` | `boolean` | DEFAULT `false` | Receive SMS only for @mentions, not all messages |
| `is_caregiver` | `boolean` | DEFAULT `false` | Admin/manager who also works caregiver shifts |
| `requires_password_change` | `boolean` | DEFAULT `false` | Forces /update-password on next login |
| `acknowledged_responsibilities` | `boolean` | nullable | Legacy: pre-documents-system acknowledgment flag |
| `last_read_messages_at` | `timestamptz` | nullable | Used to compute unread message badge |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |

**Key Constraint:**  
A DB trigger (`enforce_admin_role_assignment_trigger`) prevents anyone except an `admin` from changing the `role` column.

---

### 4.2 `public.shifts`

Scheduled work shifts.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `title` | `text` | NOT NULL | Shift name/type |
| `date` | `date` | NOT NULL | Calendar date of the shift |
| `start_time` | `timestamptz` | NOT NULL | Start datetime |
| `end_time` | `timestamptz` | NOT NULL | End datetime |
| `assigned_to` | `uuid` | nullable, FK → `users(id)` ON DELETE CASCADE | NULL = open shift |
| `custom_assigned_name` | `text` | nullable | Non-user assignment (e.g., "Agency Staff") |
| `is_open` | `boolean` | NOT NULL, DEFAULT `true` | TRUE = claimable by caregivers |
| `trade_notes` | `text` | nullable | Appended when a trade is accepted |
| `created_at` | `timestamptz` | NOT NULL | |

---

### 4.3 `public.shift_templates`

Reusable shift presets for the admin schedule builder.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `title` | `text` | NOT NULL |
| `start_time` | `time` | Time-only (no date) |
| `end_time` | `time` | Time-only (no date) |
| `created_at` | `timestamptz` | |

---

### 4.4 `public.shift_trades`

Peer-to-peer shift trade requests, including SMS-based acceptance.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `shift_id` | `uuid` | FK → `shifts(id)` ON DELETE CASCADE | The shift being traded |
| `requested_by` | `uuid` | FK → `users(id)` ON DELETE CASCADE | Caregiver initiating the trade |
| `proposed_to` | `uuid` | nullable, FK → `users(id)` ON DELETE CASCADE | Target caregiver |
| `status` | `text` | CHECK in (`'pending'`, `'approved'`, `'denied'`) DEFAULT `'pending'` | |
| `sms_code` | `text` | nullable, auto-generated by trigger | 4-char uppercase alphanumeric code for SMS replies |
| `created_at` | `timestamptz` | | |

---

### 4.5 `public.availability`

Daily availability stamps set directly by caregivers (simple per-day status).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | FK → `users(id)` ON DELETE CASCADE | |
| `date` | `date` | NOT NULL | |
| `status` | `text` | CHECK in (`'available'`, `'unavailable'`) | |
| `notes` | `text` | nullable | |
| `created_at` | `timestamptz` | | |

---

### 4.6 `public.availability_requests`

Admin-created requests asking caregivers to fill in availability for a date range.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `start_date` | `date` | NOT NULL |
| `end_date` | `date` | NOT NULL |
| `message` | `text` | nullable — instructions to caregivers |
| `target_user_ids` | `uuid[]` | nullable — if set, only these caregivers are targeted |
| `created_by` | `uuid` | FK → `users(id)` ON DELETE CASCADE |
| `created_at` | `timestamptz` | |

---

### 4.7 `public.availability_responses`

Caregiver responses to availability requests.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | FK → `users(id)` ON DELETE CASCADE | |
| `date` | `date` | NOT NULL | |
| `status` | `text` | CHECK in (`'available'`, `'unavailable'`, `'preferred'`, `'available_morning'`, `'available_evening'`) | |
| `notes` | `text` | nullable | |
| `updated_at` | `timestamptz` | DEFAULT `now()` | |
| | | UNIQUE(`user_id`, `date`) | One response per user per day |

---

### 4.8 `public.unavailability`

Blocks of time a caregiver marks as unavailable (formerly `time_off_requests`).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | FK → `users(id)` ON DELETE CASCADE | |
| `start_date` | `date` | NOT NULL | |
| `end_date` | `date` | NOT NULL | Same as start_date for single/half-day |
| `type` | `text` | NOT NULL, DEFAULT `'full_day'` | `'full_day'`, `'morning'`, `'evening'` |
| `status` | `text` | Default `'approved'` | Legacy field from time_off_requests era |
| `created_at` | `timestamptz` | | |

---

### 4.9 `public.messages`

Team communication board messages.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `author_id` | `uuid` | FK → `users(id)` ON DELETE CASCADE | |
| `topic_id` | `uuid` | nullable, FK → `message_topics(id)` | DEFAULT `'11111111-1111-1111-1111-111111111111'` (General) |
| `content` | `text` | NOT NULL | Supports `@username` and `@all` mentions |
| `image_url` | `text` | nullable | Supabase Storage URL (message-attachments bucket) |
| `created_at` | `timestamptz` | | |

---

### 4.10 `public.message_topics`

Channel/thread categories for the message board.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `title` | `text` | NOT NULL |
| `created_at` | `timestamptz` | |

**Seed data:** A "General Discussion" topic is pre-seeded with id `11111111-1111-1111-1111-111111111111`.

---

### 4.11 `public.message_reactions`

Emoji reactions on messages.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `message_id` | `uuid` | FK → `messages(id)` ON DELETE CASCADE | |
| `user_id` | `uuid` | FK → `users(id)` ON DELETE CASCADE | |
| `emoji` | `text` | NOT NULL | |
| `created_at` | `timestamptz` | | |
| | | UNIQUE(`message_id`, `user_id`, `emoji`) | One reaction type per user per message |

---

### 4.12 `public.notifications`

In-app notification records (e.g., @mentions, new documents).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | nullable, FK → `users(id)` ON DELETE CASCADE | Recipient |
| `actor_id` | `uuid` | nullable, FK → `users(id)` ON DELETE CASCADE | Who triggered it |
| `type` | `text` | NOT NULL | `'mention'`, `'document'` |
| `reference_id` | `uuid` | nullable | The message_id or document_id |
| `is_read` | `boolean` | DEFAULT `false` | |
| `created_at` | `timestamptz` | | |

---

### 4.13 `public.documents`

Admin-uploaded documents (PDFs, images, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `title` | `text` | NOT NULL |
| `description` | `text` | NOT NULL |
| `file_url` | `text` | Supabase Storage public URL |
| `file_name` | `text` | Original filename |
| `file_type` | `text` | MIME type |
| `requires_acknowledgment` | `boolean` | DEFAULT `false` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

### 4.14 `public.document_acknowledgments`

Tracks which user has acknowledged which document.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `document_id` | `uuid` | FK → `documents(id)` ON DELETE CASCADE | |
| `user_id` | `uuid` | FK → `users(id)` ON DELETE CASCADE | |
| `acknowledged_at` | `timestamptz` | DEFAULT `now()` | |
| | | UNIQUE(`document_id`, `user_id`) | One ack per user per document |

---

### 4.15 `public.responsibilities` *(Legacy)*

Original free-text responsibility items, now superseded by `documents`. Retained for rollback safety. Data was migrated into `documents` at time of schema change.

| Column | Type |
|---|---|
| `id` | `uuid` PK |
| `title` | `text` NOT NULL |
| `description` | `text` NOT NULL |
| `last_updated` | `timestamptz` |

---

### 4.16 `public.payroll_reports`

Finalized payroll report snapshots.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `start_date` | `date` | NOT NULL | |
| `end_date` | `date` | NOT NULL, UNIQUE | One report per end date |
| `generated_at` | `timestamptz` | DEFAULT `now()` | |
| `report_data` | `jsonb` | NOT NULL, DEFAULT `[]` | Array of `{ caregiver_id, name, total_hours }` |
| `status` | `text` | NOT NULL, DEFAULT `'confirmed'` | |

---

### 4.17 `public.sms_logs`

Audit log for all Twilio SMS activity (inbound and outbound).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | nullable, FK → `users(id)` ON DELETE CASCADE | |
| `phone_number` | `text` | NOT NULL | |
| `direction` | `text` | CHECK in (`'outbound'`, `'inbound'`) | |
| `message_body` | `text` | NOT NULL | |
| `status` | `text` | NOT NULL, DEFAULT `'pending'` | `'sent'`, `'received'`, `'failed'` |
| `provider_id` | `text` | nullable | Twilio Message SID |
| `error_message` | `text` | nullable | |
| `created_at` | `timestamptz` | NOT NULL | |

---

### Entity Relationship Diagram

```
auth.users (1) ──────────── (1) public.users
                                     │
               ┌─────────────────────┼──────────────────────────┐
               │                     │                          │
         shifts(n)           messages(n)                  availability(n)
               │                     │                          │
         shift_trades(n)     message_reactions(n)    availability_responses(n)
               │             message_topics(1)───►(n) messages
               │             notifications(n)
               │
         payroll_reports     documents(n)
         sms_logs(n)         document_acknowledgments(n)
         unavailability(n)   availability_requests(n)
         shift_templates
         responsibilities (legacy)
```

---

## 5. Authentication Flow

### 5.1 Normal Login (Existing Users)

```
1. User enters email + password on /auth (AuthPage.jsx)
2. supabase.auth.signInWithPassword({ email, password })
3. Supabase Auth validates credentials against auth.users
4. On success: Supabase sets a JWT in localStorage under key 'act-app-auth-token'
5. AuthContext.onAuthStateChange fires with event 'SIGNED_IN' + session object
6. AuthContext.fetchProfile(session.user.id) queries public.users for the profile row
7. Profile sets activeRole (admin > manager > caregiver hierarchy)
8. App.jsx re-renders: if session exists, /auth redirects to /
9. If profile.requires_password_change === true → redirect to /update-password
```

> **Critical:** The Supabase client is initialized with a custom `storageKey: 'act-app-auth-token'` (in `src/lib/supabase.js`). This was introduced to bypass a previous localStorage key collision. **Do not change this key** — existing logged-in users have their tokens stored under this key.

### 5.2 New Caregiver Account Creation

New caregivers are **not** self-registering. They are created by an admin via `AdminCaregiversPage.jsx`:

```
1. Admin fills in firstName, lastName, email, (optional password) in a form
2. Frontend calls the 'create-caregiver' Edge Function with a service-role-authorized request
3. Edge Function:
   a. Creates auth.users row via supabaseAdmin.auth.admin.createUser()
      - email_confirm: true (no email verification needed)
      - default password: 'Agnes2026' if not provided
      - user_metadata: { full_name, first_name, last_name }
   b. The 'on_auth_user_created' DB trigger fires and inserts a row into public.users
      with { id, email, full_name, role: 'caregiver' }
   c. Edge Function retries (up to 20x, 500ms apart) to UPDATE public.users:
      { full_name, first_name, last_name, role: 'caregiver', is_caregiver: true,
        requires_password_change: true }
4. Caregiver receives credentials from admin out-of-band
5. On first login, requires_password_change = true → forced redirect to /update-password
6. Caregiver sets a new password → requires_password_change set to false
```

### 5.3 Password Reset (Admin-Initiated)

```
1. Admin clicks "Reset Password" on AdminCaregiversPage.jsx for a caregiver
2. Frontend calls 'reset-password' Edge Function with { userId, password }
3. Edge Function:
   a. Validates calling admin's JWT
   b. supabaseAdmin.auth.admin.updateUserById(userId, { password })
   c. Sets public.users.requires_password_change = true
4. Admin communicates new temporary password to caregiver out-of-band
5. Caregiver logs in → forced to /update-password to set their own password
```

### 5.4 Password Update (Self-Service on /update-password)

```
1. Caregiver (or admin-reset user) is on /update-password (protected, no password check)
2. User enters new password, frontend calls supabase.auth.updateUser({ password })
3. On success, frontend calls supabase.from('users').update({ requires_password_change: false })
4. User is redirected to / (their dashboard)
```

### 5.5 Sign Out

```
1. User clicks Sign Out in MainLayout header
2. setActiveRole(null) is called on AuthContext
3. supabase.auth.signOut() clears the JWT from localStorage
4. onAuthStateChange fires → session = null, profile = null
5. Navigate to /welcome
```

### 5.6 Session Persistence

- Sessions are stored in `localStorage` under the key `act-app-auth-token`.
- On page load, `AuthContext` calls `supabase.auth.getSession()` to restore the session.
- A 5-second timeout is applied to `fetchProfile` to prevent a hanging load state.
- Supabase handles JWT refresh automatically.

---

## 6. Role-Based Access Control (RBAC)

### Roles

| Role | `public.users.role` value | `isAdmin` (AuthContext) | `isSuperAdmin` | Notes |
|---|---|---|---|---|
| Super Admin | `'admin'` | `true` | `true` | Full access incl. Roles page |
| Manager | `'manager'` | `true` | `false` | Same as admin except cannot change `role` column |
| Caregiver | `'caregiver'` | `false` | `false` | Standard caregiver access |

### Dual-Role Capability

A user with `role = 'admin'` or `'manager'` AND `is_caregiver = true` gets a **"Viewing as:"** dropdown in the header to switch between their admin and caregiver views. The `activeRole` state in `AuthContext` controls which dashboard and navigation is displayed.

### Frontend Enforcement

- `ProtectedRoute` (in `App.jsx`): redirects unauthenticated users to `/welcome`
- `AdminRoute` (in `src/components/AdminRoute.jsx`): redirects non-admin/manager users to `/`
- `isSuperAdmin` check in `MainLayout`: hides the Roles nav item for managers

### Backend Enforcement (Database)

- Row Level Security policies on every table (see §7)
- `enforce_admin_role_assignment_trigger`: prevents non-admins from changing `role`
- `accept_shift_trade()` and `claim_open_shift()` RPC functions validate `auth.uid()` before mutating shifts

---

## 7. Row-Level Security (RLS) Policies

All tables have RLS enabled. Summary of key policies:

### `public.users`

| Policy | Operation | Who |
|---|---|---|
| Users can view all users | SELECT | Everyone |
| Users can update own profile | UPDATE | `auth.uid() = id` |
| Admins can update users | UPDATE | `role = 'admin'` |
| Managers can update users | UPDATE | `role = 'manager'` |
| Admin-only role changes enforced by trigger | — | DB-level |

### `public.shifts`

| Policy | Who |
|---|---|
| SELECT | Everyone |
| INSERT/UPDATE/DELETE (Admins can manage shifts) | `role = 'admin'` |
| INSERT/UPDATE/DELETE (Managers can manage shifts) | `role = 'manager'` |

### `public.shift_trades`

| Policy | Who |
|---|---|
| SELECT (involved parties) | `requested_by = auth.uid()` OR `proposed_to = auth.uid()` |
| INSERT | `requested_by = auth.uid()` |
| UPDATE (proposed_to can accept) | `proposed_to = auth.uid()` |
| UPDATE (Admins/Managers can update) | `role IN ('admin', 'manager')` |

### `public.availability` / `public.availability_responses`

| Policy | Who |
|---|---|
| SELECT | Everyone |
| ALL (own records) | `auth.uid() = user_id` |
| ALL (admins/managers full access) | `role IN ('admin', 'manager')` |

### `public.messages`

| Policy | Who |
|---|---|
| SELECT | Everyone |
| INSERT | `auth.uid() = author_id` |
| DELETE (admin) | `role = 'admin'` |

### `public.notifications`

| Policy | Who |
|---|---|
| SELECT | `auth.uid() = user_id` |
| INSERT | Any authenticated user |
| UPDATE | `auth.uid() = user_id` |

### `public.documents`

| Policy | Who |
|---|---|
| SELECT | Everyone |
| ALL (manage) | `role IN ('admin', 'manager')` |

### `public.document_acknowledgments`

| Policy | Who |
|---|---|
| SELECT | Own or admin/manager |
| INSERT | `auth.uid() = user_id` |
| ALL (manage) | `role IN ('admin', 'manager')` |

### `public.payroll_reports`

| Policy | Who |
|---|---|
| SELECT | `role = 'admin'` (or `'manager'` per manager_payroll_reports_policy.sql) |
| INSERT | `role = 'admin'` |
| DELETE | `role = 'admin'` |

### `public.sms_logs`

| Policy | Who |
|---|---|
| SELECT (all logs) | `role = 'admin'` |
| SELECT (own logs) | `auth.uid() = user_id` |
| INSERT | `role = 'admin'` (service role bypasses for edge function inserts) |

### Storage Buckets

| Bucket | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `avatars` | Public | Own folder (`auth.uid()` as folder prefix) | Own folder | Own folder |
| `documents` | Public | Admin/Manager | Admin/Manager | Admin/Manager |
| `message-attachments` | Public | Any authenticated user | — | — |

---

## 8. API — Supabase Edge Functions

All Edge Functions are deployed to the Supabase project. They are called from the frontend via `supabase.functions.invoke(name, { body })` or directly with `fetch`.

### `POST /functions/v1/create-caregiver`

**Purpose:** Creates a new caregiver account (auth + profile).  
**Authorization:** Requires a valid JWT (admin session).  
**Request Body:**
```json
{ "email": "string", "firstName": "string", "lastName": "string", "password": "string?" }
```
**Response:**
```json
{ "success": true, "user": { ...authUser } }
// or
{ "error": "string" }
```
**Notes:** Sets `requires_password_change: true`. Default password is `'Agnes2026'` if not provided. Uses a retry loop (up to 20 attempts) to wait for the auth trigger to create the `public.users` row before updating it.

---

### `POST /functions/v1/reset-password`

**Purpose:** Admin resets a caregiver's password and flags them for forced change.  
**Authorization:** Requires valid JWT (admin session, validated inside function).  
**Request Body:**
```json
{ "userId": "uuid", "password": "string" }
```
**Response:**
```json
{ "success": true }
```

---

### `POST /functions/v1/update-user-contact`

**Purpose:** Admin updates a caregiver's email, phone, and/or password in both `auth.users` and `public.users`.  
**Authorization:** Requires valid JWT.  
**Request Body:**
```json
{ "userId": "uuid", "email": "string?", "phone": "string?", "password": "string?" }
```
**Response:**
```json
{ "success": true }
```
**Notes:** Always sets `requires_password_change: true` after update.

---

### `POST /functions/v1/send-sms`

**Purpose:** Sends an outbound SMS via Twilio. Can target a user by `userId` OR a raw phone number via `to`.  
**Authorization:** Can be called with anon key (from DB trigger via `net.http_post`) or from the frontend.  
**Request Body:**
```json
{ "userId": "uuid?", "to": "string?", "messageBody": "string" }
```
**Response:**
```json
{ "success": true, "sid": "SMXXXXXXX" }
// or
{ "error": "string", "twilioCode": number }
```
**Notes:** Checks `sms_enabled` for user-targeted sends. Logs all sends to `public.sms_logs`. Uses Twilio environment variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

---

### `POST /functions/v1/handle-sms-reply`

**Purpose:** Twilio Webhook receiver — processes inbound SMS from caregivers.  
**Authorization:** None (Twilio calls this directly). Must be set as Twilio Messaging Webhook URL.  
**Content-Type:** `application/x-www-form-urlencoded` (Twilio format)  
**Twilio Fields:** `From` (phone number), `Body` (message text)  
**Logic:**
1. Looks up user by phone number in `public.users`
2. Logs inbound SMS to `sms_logs`
3. If body starts with `YES [CODE]` → finds matching `shift_trades` record for that user and code, sets `status = 'approved'`, updates `shifts.assigned_to`, and posts a message to the board
4. Returns empty TwiML (`<Response></Response>`) — no auto-reply

---

## 9. Database Stored Functions & Triggers

### Triggers on `auth.users`

| Trigger | Function | Event | Effect |
|---|---|---|---|
| `on_auth_user_created` | `public.handle_new_user()` | AFTER INSERT | Creates corresponding row in `public.users` with `role = 'caregiver'` |

### Triggers on `public.users`

| Trigger | Function | Event | Effect |
|---|---|---|---|
| `enforce_admin_role_assignment_trigger` | `public.check_role_update_permission()` | BEFORE UPDATE | Raises exception if non-admin tries to change `role` column |

### Triggers on `public.shift_trades`

| Trigger | Function | Event | Effect |
|---|---|---|---|
| `trigger_generate_sms_code` | `generate_sms_code()` | BEFORE INSERT | Auto-generates a 4-char uppercase alphanumeric `sms_code` if not provided |

### Triggers on `public.messages`

| Trigger | Function | Event | Effect |
|---|---|---|---|
| `trigger_notify_on_message` | `notify_caregivers_on_message()` | AFTER INSERT | Broadcasts new message via `send-sms` edge function to all SMS-enabled caregivers with `sms_only_mentions = false` (skips if message only contains individual @tags) |

### Triggers on `public.notifications`

| Trigger | Function | Event | Effect |
|---|---|---|---|
| `trigger_notify_on_mention` | `notify_caregiver_on_mention()` | AFTER INSERT | Sends SMS to mentioned caregiver if they have `sms_enabled = true` and a phone number |

### RPC Functions (callable from client)

| Function | Signature | Security | Purpose |
|---|---|---|---|
| `accept_shift_trade` | `(trade_id uuid) → void` | SECURITY DEFINER | Validates proposed_to = auth.uid(), sets trade approved, reassigns shift |
| `claim_open_shift` | `(shift_uuid uuid) → void` | SECURITY DEFINER | Validates shift is open and unassigned, assigns it to auth.uid() |

---

## 10. Storage Buckets

| Bucket ID | Public | Max File Size | Allowed MIME Types | Used By |
|---|---|---|---|---|
| `avatars` | Yes | Default | Any image | ProfilePage.jsx — user profile photos |
| `documents` | Yes | Default | Any | AdminDocumentsPage.jsx — uploaded PDFs, images |
| `message-attachments` | Yes | 5 MB | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/heic` | MessagesPage.jsx — inline image attachments |

---

## 11. Real-Time Subscriptions

The app uses Supabase Realtime (WebSockets) for live updates. Tables included in `supabase_realtime` publication:

| Table | Subscribed In | Purpose |
|---|---|---|
| `public.messages` | `MainLayout.jsx`, `MessagesPage.jsx` | Unread badge, live message board |
| `public.notifications` | `MainLayout.jsx` | Live notification bell |
| `public.availability_requests` | `AvailabilityPage.jsx` | Live admin requests |

---

## 12. SMS Integration (Twilio)

### Architecture

```
DB Trigger (AFTER INSERT on messages or notifications)
  → net.http_post → send-sms Edge Function
  → Twilio REST API → Caregiver's Phone

Caregiver replies "YES 1A2B"
  → Twilio Webhook → handle-sms-reply Edge Function
  → Updates shift_trades.status = 'approved'
  → Updates shifts.assigned_to
```

### SMS Preferences per User

| Field | Meaning |
|---|---|
| `sms_enabled = false` | No SMS at all |
| `sms_enabled = true`, `sms_only_mentions = false` | Receives SMS for ALL new messages |
| `sms_enabled = true`, `sms_only_mentions = true` | Receives SMS only when @mentioned |

### Required Twilio Environment Variables (Supabase Secrets)

```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER   # The "From" number (e.g., +15551234567)
```

---

## 13. Frontend Routing

All routes are defined in `src/App.jsx`. The app uses React Router DOM v7.

### Public Routes (no auth required)

| Path | Component | Notes |
|---|---|---|
| `/welcome` | `LandingPage` | Redirects to `/` if already authenticated |
| `/auth` | `AuthPage` | Login form. Redirects to `/` if authenticated |
| `/terms` | `TermsOfServicePage` | Always accessible |
| `/privacy` | `PrivacyPolicyPage` | Always accessible |
| `/opt-in` | `OptInExamplePage` | SMS opt-in example |

### Protected Routes (requires valid session)

All are children of `/` which renders `MainLayout`.

| Path | Component | Role Required | Notes |
|---|---|---|---|
| `/update-password` | `UpdatePasswordPage` | Any authenticated | `requirePasswordCheck = false` — accessible even with requires_password_change flag |
| `/` (index) | `AdminDashboardPage` OR `DashboardPage` | Any | Switches based on `isAdmin` |
| `/schedule` | `SchedulePage` | Any | Caregiver schedule view |
| `/availability` | `AvailabilityPage` | Any | Caregiver availability form |
| `/messages` | `MessagesPage` | Any | Team message board |
| `/documents` | `CaregiverDocumentsPage` | Any | Read-only document view |
| `/directory` | `CaregiverDirectoryPage` | Any | Team contact directory |
| `/profile` | `ProfilePage` | Any | Edit own profile, SMS prefs, avatar |
| `/admin/caregivers` | `AdminCaregiversPage` | admin or manager | Manage team |
| `/admin/documents` | `AdminDocumentsPage` | admin or manager | Upload/manage docs |
| `/admin/schedule` | `AdminSchedulePage` | admin or manager | Full schedule CRUD |
| `/admin/reports` | `AdminReportsPage` | admin or manager | Analytics |
| `/admin/payroll` | `AdminPayrollPage` | admin or manager | Hours & payroll |
| `/admin/roles` | `AdminRolesPage` | admin or manager | Role assignment |

> **Note:** The `/admin` index route used in the nav links (e.g. `<NavLink to="/admin">`) implicitly resolves to the `/` route because `isAdmin` redirects to `AdminDashboardPage`.

### Route Guards

- `ProtectedRoute`: Checks `session`. If missing → `/welcome`. If `requires_password_change` → `/update-password`.
- `AdminRoute`: Checks `isAdmin`. If false → `/`. Uses `useEffect` + `navigate` (not render-time redirect).

---

## 14. Environment Variables

### Frontend (`.env` / `VITE_*` prefix)

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Public anon key |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Local dev only | Used by `supabaseAdmin.js` — **never commit to Git** |

### Edge Functions (Supabase Secrets)

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | Yes (auto-injected) | Injected by Supabase runtime |
| `SUPABASE_ANON_KEY` | Yes (auto-injected) | Injected by Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (auto-injected) | Injected by Supabase runtime |
| `TWILIO_ACCOUNT_SID` | Yes (for SMS) | Set via Supabase Dashboard → Edge Functions → Secrets |
| `TWILIO_AUTH_TOKEN` | Yes (for SMS) | |
| `TWILIO_PHONE_NUMBER` | Yes (for SMS) | E.164 format: `+15551234567` |
| `TWILIO_API_KEY_SID` | Yes (for send-schedule-broadcast) | Twilio API Key SID; set via Dashboard → Edge Functions → Secrets. |
| `TWILIO_API_KEY_SECRET` | Yes (for send-schedule-broadcast) | Twilio API Key Secret. |

> **Note:** The `send-schedule-broadcast` function authenticates to Twilio using the API Key (`TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET`) pair, whereas the `send-sms` function uses the account's primary `TWILIO_AUTH_TOKEN`. Both are valid Twilio authentication methods, but they are not interchangeable.

---

## 15. Database Migration History

Migrations are in `supabase/migrations/` and are applied in timestamp order.

| File | Date | Change |
|---|---|---|
| `20231001000000_initial_schema.sql` | 2023-10-01 | Initial tables: users, shifts, availability, time_off_requests, responsibilities, messages, shift_trades. All RLS policies. Realtime on messages. |
| `20260303000000_add_requires_password_change.sql` | 2026-03-03 | Added `requires_password_change` to users |
| `20260307172033_add_first_last_name.sql` | 2026-03-07 | Added `first_name`, `last_name` to users; backfilled from `full_name` |
| `20260308000000_add_is_caregiver.sql` | 2026-03-08 | Added `is_caregiver` flag for dual-role users |
| `20260313171738_add_on_delete_cascade.sql` | 2026-03-13 | Changed all FK constraints to ON DELETE CASCADE across 9 tables |
| `20260327175816_update_availability.sql` | 2026-03-27 | Added `notes` to `availability_responses`; expanded status CHECK to include `available_morning`, `available_evening` |
| `20260327180816_claim_open_shift.sql` | 2026-03-27 | Added `claim_open_shift()` RPC function |
| `20260328113526_consolidate_phone_number.sql` | 2026-03-28 | Migrated `phone_number` → `phone`, dropped `phone_number` column |
| `20260424125900_add_message_images.sql` | 2026-04-24 | Added `image_url` to messages; created `message-attachments` storage bucket with RLS |
| `20260523000000_create_message_sms_trigger.sql` | 2026-05-23 | Added `sms_only_mentions` to users; created `notify_caregivers_on_message()` and `notify_caregiver_on_mention()` triggers |

### Ad-Hoc SQL Scripts (manually applied via Supabase SQL Editor)

These are in `supabase/` root (not versioned migrations):

| File | Purpose |
|---|---|
| `setup_auth_trigger.sql` | Creates `on_auth_user_created` trigger |
| `team_comm_updates.sql` | Creates `message_topics`, `message_reactions`, `notifications` tables |
| `documents_schema.sql` | Creates `documents`, `document_acknowledgments` tables + storage bucket |
| `availability_schema.sql` | Creates `availability_requests`, `availability_responses` tables |
| `unavailability_migration.sql` | Renames `time_off_requests` → `unavailability`, adds `type` column |
| `trade_shifts_setup.sql` | Adds `trade_notes` to shifts, `accept_shift_trade()` RPC, shift trade RLS |
| `shift_templates_schema.sql` | Creates `shift_templates` table |
| `payroll_reports_table.sql` | Creates `payroll_reports` table |
| `sms_integration_setup.sql` | Creates `sms_logs` table; adds `sms_enabled` to users |
| `sms_unique_code_setup.sql` | Adds `sms_code` to `shift_trades`; auto-generation trigger |
| `avatar_schema.sql` | Creates `avatars` storage bucket; adds `avatar_url` to users |
| `missing_user_columns.sql` | Adds `status` and `payroll_enabled` to users |
| `enforce_admin_role_assignment.sql` | Creates role-change protection trigger |
| `manager_rls_policies.sql` | Adds manager-role RLS policies across core tables |
| `admin_users_policy.sql` | Adds admin UPDATE policy on users table |
| `payroll_reports_unique_end_date.sql` | Adds UNIQUE constraint on `payroll_reports.end_date` |
| `documents_requires_ack.sql` | Adds `requires_acknowledgment` to documents |
| `unread_messages_setup.sql` | Adds `last_read_messages_at` to users |
| `payroll_contact_column.sql` | Adds `payroll_report_contact` to users |
| `enable_notifications_realtime.sql` | Adds notifications to realtime publication |
| `selective_availability_requests.sql` | Adds `target_user_ids` to `availability_requests` |
| `custom_shift_name.sql` | Adds `custom_assigned_name` to shifts |
| `fix_availability_rls.sql` | Patches availability RLS |
| `fix_shift_trades_insert_rls.sql` | Patches shift trades INSERT RLS |
| `allow_message_deletions.sql` | Adds message DELETE policy for admins |
| `manager_payroll_reports_policy.sql` | Extends payroll report access to managers |

---

## 16. Key Design Decisions & Guard Rails

1. **Auth Storage Key:** `act-app-auth-token` — do not rename; existing user sessions would be invalidated.

2. **Dual-Role via `is_caregiver` flag:** An admin or manager can also be listed as a caregiver by setting `is_caregiver = true`. This unlocks the role-switcher in the header. Role assignment only changes `role`, not `is_caregiver`.

3. **Service Role Key in Frontend:** `supabaseAdmin.js` imports the service role key via `VITE_SUPABASE_SERVICE_ROLE_KEY`. This is intentionally **local dev only** and must never be deployed or committed. Production admin operations go through Edge Functions.

4. **No Self-Registration:** Caregivers cannot create their own accounts. All accounts are created by admins via the `create-caregiver` Edge Function.

5. **Cascade Deletes:** All FK relationships use ON DELETE CASCADE. Deleting a user from `auth.users` (via Supabase Auth admin) cascades and removes all their shifts, messages, availability, etc.

6. **SMS Trigger Placeholders:** The `notify_caregivers_on_message()` and `notify_caregiver_on_mention()` PL/pgSQL functions contain hardcoded `project_url` and `service_role_key` placeholder strings. These must be replaced with actual values (or better: use `current_setting()` or a secrets vault) for production SMS triggers to fire correctly.

7. **`responsibilities` Table:** Retained post-migration to `documents` for rollback safety. It is no longer written to by the frontend.

8. **Payroll Uniqueness:** `payroll_reports.end_date` has a UNIQUE constraint — only one report per period end date can be saved.

9. **Shift Trade SMS Code:** Automatically generated as a 4-char uppercase alphanumeric `sms_code` on every new `shift_trades` INSERT. Caregivers reply `YES [CODE]` to accept.
