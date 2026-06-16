-- Hold a pending no-photo expense so the bot can ask the caregiver to attach a receipt
-- or file without one (additive).
alter table public.sms_expense_sessions
  add column if not exists awaiting_receipt boolean not null default false,
  add column if not exists pending_amount numeric(10,2),
  add column if not exists pending_description text;
