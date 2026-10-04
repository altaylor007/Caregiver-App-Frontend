-- Already applied in production on 2026-10-04. Kept for documentation; do not re-run.
create table if not exists public.caregiver_pay_rates (
  user_id uuid primary key references public.users(id) on delete cascade,
  hourly_rate numeric(6,2) not null check (hourly_rate > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

alter table public.caregiver_pay_rates enable row level security;

create policy "Admins and managers can read pay rates"
  on public.caregiver_pay_rates for select
  using (exists (select 1 from public.users where id = auth.uid() and role in ('admin','manager')));

create policy "Admins and managers can add pay rates"
  on public.caregiver_pay_rates for insert
  with check (exists (select 1 from public.users where id = auth.uid() and role in ('admin','manager')));

create policy "Admins and managers can update pay rates"
  on public.caregiver_pay_rates for update
  using (exists (select 1 from public.users where id = auth.uid() and role in ('admin','manager')))
  with check (exists (select 1 from public.users where id = auth.uid() and role in ('admin','manager')));
