-- Caregiver expense reimbursements (additive; no existing tables altered)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  description text not null,
  receipt_url text,
  source text not null default 'app' check (source in ('app','sms')),
  status text not null default 'submitted' check (status in ('submitted','reimbursed','rejected')),
  rejection_reason text,
  payroll_report_id uuid references public.payroll_reports(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now()
);

create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists expenses_status_submitted_idx on public.expenses(status, submitted_at);

alter table public.expenses enable row level security;

drop policy if exists "Users can view own expenses" on public.expenses;
create policy "Users can view own expenses" on public.expenses
  for select using (auth.uid() = user_id);

drop policy if exists "Admins and managers can view all expenses" on public.expenses;
create policy "Admins and managers can view all expenses" on public.expenses
  for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager')));

drop policy if exists "Users can submit own expenses" on public.expenses;
create policy "Users can submit own expenses" on public.expenses
  for insert with check (auth.uid() = user_id and status = 'submitted');

drop policy if exists "Admins and managers can update expenses" on public.expenses;
create policy "Admins and managers can update expenses" on public.expenses
  for update using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager')));

-- Private receipts bucket (receipts may carry PII, unlike existing public buckets)
insert into storage.buckets (id, name, public)
  values ('receipts','receipts', false)
  on conflict (id) do nothing;

drop policy if exists "Users upload receipts to own folder" on storage.objects;
create policy "Users upload receipts to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owner or staff can read receipts" on storage.objects;
create policy "Owner or staff can read receipts" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager'))));
