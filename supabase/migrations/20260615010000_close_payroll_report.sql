-- Atomic payroll close: insert the report and settle expenses in one transaction.
create or replace function public.close_payroll_report(
  p_start_date date,
  p_end_date date,
  p_report_data jsonb,
  p_reimbursed_ids uuid[],
  p_declined jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_report_id uuid;
  v_item jsonb;
begin
  -- Authorize: only admin/manager may close payroll
  select role into v_role from public.users where id = auth.uid();
  if v_role is null or v_role not in ('admin','manager') then
    raise exception 'Not authorized to close payroll';
  end if;

  -- Insert the report (UNIQUE on end_date blocks duplicates; rolls back whole tx)
  insert into public.payroll_reports (start_date, end_date, report_data, status)
  values (p_start_date, p_end_date, p_report_data, 'confirmed')
  returning id into v_report_id;

  -- Mark included expenses as reimbursed, stamped to this report
  if p_reimbursed_ids is not null and array_length(p_reimbursed_ids, 1) is not null then
    update public.expenses
       set status = 'reimbursed',
           payroll_report_id = v_report_id,
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = any(p_reimbursed_ids)
       and status = 'submitted';
  end if;

  -- Mark declined expenses as rejected with their reason
  if p_declined is not null then
    for v_item in select * from jsonb_array_elements(p_declined)
    loop
      update public.expenses
         set status = 'rejected',
             rejection_reason = nullif(v_item->>'reason', ''),
             reviewed_by = auth.uid(),
             reviewed_at = now()
       where id = (v_item->>'id')::uuid
         and status = 'submitted';
    end loop;
  end if;

  return v_report_id;
end;
$$;

grant execute on function public.close_payroll_report(date, date, jsonb, uuid[], jsonb) to authenticated;
