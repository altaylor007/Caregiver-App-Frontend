-- Tracks an in-progress "EXPENSE" SMS workflow so a follow-up text is read as the details (additive).
create table if not exists public.sms_expense_sessions (
  user_id uuid primary key references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.sms_expense_sessions enable row level security;
-- No policies: only the service-role edge function touches this table; RLS blocks all client access.
