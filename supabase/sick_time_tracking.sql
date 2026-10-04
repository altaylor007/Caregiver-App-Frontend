-- Applied in production on 2026-10-04. Kept for documentation; do not re-run.

-- Sick time (MN ESST) tracking. Additive only.

create table if not exists public.sick_time_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  as_of_date date not null,
  opening_balance numeric(6,2) not null check (opening_balance >= 0 and opening_balance <= 80),
  opening_ytd_hours numeric(8,2) not null default 0 check (opening_ytd_hours >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

-- hours = hours paid from the sick balance. absent_hours = total hours missed (>= hours); the difference is unpaid.
create table if not exists public.sick_time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  used_on date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24 and mod(hours, 0.25) = 0),
  absent_hours numeric(5,2) not null check (absent_hours > 0 and absent_hours <= 24 and mod(absent_hours, 0.25) = 0),
  shift_id uuid references public.shifts(id) on delete set null,
  note text,
  entered_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.users(id) on delete set null,
  check (hours <= absent_hours)
);

create index if not exists sick_time_entries_user_date_idx on public.sick_time_entries (user_id, used_on);

alter table public.sick_time_settings enable row level security;
alter table public.sick_time_entries enable row level security;

create policy "Sick settings readable by managers or the payroll caregiver"
  on public.sick_time_settings for select
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager'))
    or (user_id = auth.uid() and exists (select 1 from public.users u where u.id = auth.uid() and u.payroll_enabled = true))
  );

create policy "Managers can add sick settings for payroll caregivers"
  on public.sick_time_settings for insert
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager'))
    and exists (select 1 from public.users t where t.id = user_id and t.payroll_enabled = true)
  );

create policy "Managers can update sick settings for payroll caregivers"
  on public.sick_time_settings for update
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager')))
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager'))
    and exists (select 1 from public.users t where t.id = user_id and t.payroll_enabled = true)
  );

create policy "Sick entries readable by managers or the payroll caregiver"
  on public.sick_time_entries for select
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','manager'))
    or (user_id = auth.uid() and exists (select 1 from public.users u where u.id = auth.uid() and u.payroll_enabled = true))
  );

-- No insert/update/delete policies on entries: all writes go through the functions below.

create or replace function public.sick_time_compute(p_user uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sick_time_settings%rowtype;
  w record;
  v_balance numeric;
  v_ytd numeric;
  v_year int;
  v_earned_prev int;
  v_earned int;
  v_worked numeric;
  v_used_week numeric;
  v_used_in_weeks numeric := 0;
  v_used_total numeric;
begin
  select * into s from public.sick_time_settings where user_id = p_user;
  if not found then
    return null;
  end if;

  v_balance := s.opening_balance;
  v_ytd := s.opening_ytd_hours;
  v_year := extract(year from s.as_of_date)::int;
  v_earned_prev := least(48, floor(v_ytd / 30))::int;

  for w in
    select r.start_date, r.end_date, r.report_data
      from public.payroll_reports r
     where r.end_date > s.as_of_date
     order by r.end_date
  loop
    if extract(year from w.end_date)::int <> v_year then
      v_year := extract(year from w.end_date)::int;
      v_ytd := 0;
      v_earned_prev := 0;
    end if;

    select coalesce(sum(
             coalesce(
               (e->>'regular_hours')::numeric + (e->>'holiday_hours')::numeric,
               (e->>'total_hours')::numeric,
               0)
           ), 0)
      into v_worked
      from jsonb_array_elements(w.report_data) e
     where e->>'caregiver_id' = p_user::text;

    select coalesce(sum(hours), 0) into v_used_week
      from public.sick_time_entries
     where user_id = p_user
       and voided_at is null
       and used_on > s.as_of_date
       and used_on between w.start_date and w.end_date;

    v_ytd := v_ytd + v_worked;
    v_earned := least(48, floor(v_ytd / 30))::int;
    v_balance := least(80, v_balance + (v_earned - v_earned_prev)) - v_used_week;
    v_earned_prev := v_earned;
    v_used_in_weeks := v_used_in_weeks + v_used_week;
  end loop;

  select coalesce(sum(hours), 0) into v_used_total
    from public.sick_time_entries
   where user_id = p_user and voided_at is null and used_on > s.as_of_date;

  v_balance := v_balance - (v_used_total - v_used_in_weeks);

  return jsonb_build_object(
    'available', v_balance,
    'ytd_hours', v_ytd,
    'earned_this_year', v_earned_prev,
    'as_of_date', s.as_of_date
  );
end;
$$;

revoke all on function public.sick_time_compute(uuid) from public, anon, authenticated;

create or replace function public.get_sick_time_balance(p_user uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_pay boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select role into v_role from public.users where id = auth.uid();
  if not (coalesce(v_role in ('admin','manager'), false) or p_user = auth.uid()) then
    raise exception 'Not authorized';
  end if;
  select payroll_enabled into v_pay from public.users where id = p_user;
  if not coalesce(v_pay, false) then
    return null;
  end if;
  return public.sick_time_compute(p_user);
end;
$$;

revoke all on function public.get_sick_time_balance(uuid) from public, anon;
grant execute on function public.get_sick_time_balance(uuid) to authenticated;

-- p_hours = hours missed. Paid hours = min(p_hours, available balance), in quarter hours. The rest is unpaid.
create or replace function public.log_sick_time(
  p_user uuid,
  p_used_on date,
  p_hours numeric,
  p_shift_id uuid default null,
  p_release_shift boolean default false,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_is_mgr boolean;
  v_pay boolean;
  v_as_of date;
  v_shift public.shifts%rowtype;
  v_dur numeric := 0;
  v_prior numeric := 0;
  v_date date := p_used_on;
  v_bal jsonb;
  v_avail numeric;
  v_paid numeric;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select role into v_role from public.users where id = auth.uid();
  v_is_mgr := coalesce(v_role in ('admin','manager'), false);
  if not v_is_mgr and p_user <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  select payroll_enabled into v_pay from public.users where id = p_user;
  if not coalesce(v_pay, false) then
    raise exception 'Sick time is only available to caregivers on formal payroll';
  end if;

  select as_of_date into v_as_of from public.sick_time_settings where user_id = p_user for update;
  if not found then
    raise exception 'Sick time has not been set up for this caregiver yet';
  end if;

  if p_hours is null or p_hours <= 0 or p_hours > 24 or mod(p_hours, 0.25) <> 0 then
    raise exception 'Hours must be a positive amount in quarter-hour steps';
  end if;

  if p_shift_id is not null then
    select * into v_shift from public.shifts where id = p_shift_id for update;
    if not found then
      raise exception 'Shift not found';
    end if;
    if v_shift.assigned_to is distinct from p_user then
      raise exception 'That shift is not assigned to this caregiver';
    end if;
    v_date := v_shift.date;
    v_dur := extract(epoch from (v_shift.end_time - v_shift.start_time))::numeric / 3600;
    if v_dur < 0 then v_dur := v_dur + 24; end if;
    v_dur := round(v_dur, 2);
    select coalesce(sum(absent_hours), 0) into v_prior
      from public.sick_time_entries
     where shift_id = p_shift_id and voided_at is null;
    if v_prior + p_hours > v_dur then
      raise exception 'That is more than the length of the shift';
    end if;
  elsif p_release_shift then
    raise exception 'Pick a shift to release';
  end if;

  if v_date <= v_as_of then
    raise exception 'That date is before sick time tracking began for this caregiver';
  end if;

  v_bal := public.sick_time_compute(p_user);
  v_avail := (v_bal->>'available')::numeric;
  v_paid := least(p_hours, floor(v_avail * 4) / 4);
  if v_paid <= 0 then
    raise exception 'No sick time available';
  end if;

  insert into public.sick_time_entries (user_id, used_on, hours, absent_hours, shift_id, note, entered_by)
  values (p_user, v_date, v_paid, p_hours, p_shift_id, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
  returning id into v_id;

  if p_release_shift then
    if v_prior + p_hours < v_dur then
      raise exception 'Only a fully missed shift can be released. For a partial shift, leave it assigned.';
    end if;
    update public.shifts
       set assigned_to = null, is_open = true
     where id = p_shift_id and assigned_to = p_user;
  end if;

  return jsonb_build_object('id', v_id, 'paid_hours', v_paid, 'unpaid_hours', p_hours - v_paid);
end;
$$;

revoke all on function public.log_sick_time(uuid, date, numeric, uuid, boolean, text) from public, anon;
grant execute on function public.log_sick_time(uuid, date, numeric, uuid, boolean, text) to authenticated;

create or replace function public.void_sick_time(p_entry_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select role into v_role from public.users where id = auth.uid();
  if not coalesce(v_role in ('admin','manager'), false) then
    raise exception 'Not authorized';
  end if;
  update public.sick_time_entries
     set voided_at = now(), voided_by = auth.uid()
   where id = p_entry_id and voided_at is null;
end;
$$;

revoke all on function public.void_sick_time(uuid) from public, anon;
grant execute on function public.void_sick_time(uuid) to authenticated;
