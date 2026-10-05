-- Applied in production on 2026-10-05. Replaces void_sick_time from sick_time_tracking.sql. Do not re-run.

-- Replaces void_sick_time. After voiding an entry, freed balance is used to fund the same caregiver's other entries that have an unpaid remainder, oldest first, but only for pay weeks that are not yet finalized.

create or replace function public.void_sick_time(p_entry_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_user uuid;
  e record;
  v_avail numeric;
  v_add numeric;
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
   where id = p_entry_id and voided_at is null
   returning user_id into v_user;

  if v_user is null then
    return;
  end if;

  perform 1 from public.sick_time_settings where user_id = v_user for update;

  for e in
    select t.id, t.hours, t.absent_hours
      from public.sick_time_entries t
     where t.user_id = v_user
       and t.voided_at is null
       and t.absent_hours > t.hours
       and not exists (
         select 1 from public.payroll_reports r
          where t.used_on between r.start_date and r.end_date
       )
     order by t.used_on, t.created_at
  loop
    v_avail := (public.sick_time_compute(v_user)->>'available')::numeric;
    if v_avail is null then
      exit;
    end if;
    v_add := least(e.absent_hours - e.hours, floor(v_avail * 4) / 4);
    if v_add > 0 then
      update public.sick_time_entries set hours = hours + v_add where id = e.id;
    end if;
  end loop;
end;
$$;

revoke all on function public.void_sick_time(uuid) from public, anon;
grant execute on function public.void_sick_time(uuid) to authenticated;
