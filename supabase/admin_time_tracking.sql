-- Admin Time (non-shift hours logged by managers/admins for themselves).
-- Additive only: one new table, one SELECT policy, two functions.
-- Writes happen only through log_admin_time / void_admin_time (no insert/update/delete policies).

create table if not exists public.admin_time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  work_date date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24 and mod(hours, 0.25) = 0),
  note text,
  entered_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.users(id) on delete set null
);

create index if not exists admin_time_entries_user_date_idx
  on public.admin_time_entries (user_id, work_date);

alter table public.admin_time_entries enable row level security;

drop policy if exists "Admin time readable by admins and managers" on public.admin_time_entries;
create policy "Admin time readable by admins and managers"
  on public.admin_time_entries for select
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager'))
  );

create or replace function public.log_admin_time(
  p_work_date date,
  p_hours numeric,
  p_note text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_id uuid;
begin
  select role into v_role from public.users where id = auth.uid();
  if v_role is null or v_role not in ('admin','manager') then
    raise exception 'Only admins and managers can log admin time';
  end if;
  if p_work_date is null then
    raise exception 'Date is required';
  end if;
  if p_hours is null or p_hours <= 0 or p_hours > 24 or mod(p_hours, 0.25) <> 0 then
    raise exception 'Hours must be between 0.25 and 24 in quarter-hour steps';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'A short description is required';
  end if;
  if exists (
    select 1 from public.payroll_reports r
     where p_work_date between r.start_date and r.end_date
  ) then
    raise exception 'That date is in a payroll period that is already finalized';
  end if;

  insert into public.admin_time_entries (user_id, work_date, hours, note, entered_by)
  values (auth.uid(), p_work_date, p_hours, btrim(p_note), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_admin_time(date, numeric, text) from public, anon;
grant execute on function public.log_admin_time(date, numeric, text) to authenticated;

create or replace function public.void_admin_time(p_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  e public.admin_time_entries%rowtype;
begin
  select role into v_role from public.users where id = auth.uid();
  if v_role is null or v_role not in ('admin','manager') then
    raise exception 'Only admins and managers can void admin time';
  end if;

  select * into e from public.admin_time_entries where id = p_id;
  if not found then
    raise exception 'Entry not found';
  end if;
  if e.voided_at is not null then
    raise exception 'Entry is already voided';
  end if;
  if v_role <> 'admin' and e.user_id <> auth.uid() then
    raise exception 'Managers can only void their own entries';
  end if;
  if exists (
    select 1 from public.payroll_reports r
     where e.work_date between r.start_date and r.end_date
  ) then
    raise exception 'That date is in a payroll period that is already finalized';
  end if;

  update public.admin_time_entries
     set voided_at = now(), voided_by = auth.uid()
   where id = p_id;
end;
$$;

revoke all on function public.void_admin_time(uuid) from public, anon;
grant execute on function public.void_admin_time(uuid) to authenticated;
