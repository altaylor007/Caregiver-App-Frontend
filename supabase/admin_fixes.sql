-- Fix 1: Ensure any users missing from public.users get added
insert into public.users (id, email, full_name, role)
select id, email, raw_user_meta_data->>'full_name', 'caregiver'
from auth.users
where id not in (select id from public.users);

-- Fix 2: Add policy so Caregivers can pick up open shifts
drop policy if exists "Caregivers can pick up open shifts" on public.shifts;
create policy "Caregivers can pick up open shifts" on public.shifts for update 
using (is_open = true) 
with check (assigned_to = auth.uid() and is_open = false);
