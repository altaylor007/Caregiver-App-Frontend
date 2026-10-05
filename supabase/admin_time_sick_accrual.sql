-- Admin Time counts as worked time for sick-time accrual.
-- Only change vs sick_time_tracking.sql: report rows may carry admin_hours; missing admin_hours counts as 0, so existing reports are unaffected.
-- Run AFTER supabase/admin_time_tracking.sql and BEFORE the first payroll report is finalized that includes admin hours.

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
             + coalesce((e->>'admin_hours')::numeric, 0)
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
