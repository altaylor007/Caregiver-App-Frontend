-- Link an amended/resubmitted expense back to the rejected one it replaces (additive).
alter table public.expenses
  add column if not exists resubmitted_from uuid references public.expenses(id) on delete set null;
