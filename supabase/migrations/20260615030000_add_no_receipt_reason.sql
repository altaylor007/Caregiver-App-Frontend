-- Explanation captured when a caregiver submits an expense without a receipt (additive).
alter table public.expenses
  add column if not exists no_receipt_reason text;
