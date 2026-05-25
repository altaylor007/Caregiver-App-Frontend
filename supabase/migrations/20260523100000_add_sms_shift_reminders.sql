ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sms_shift_reminders boolean NOT NULL DEFAULT true;
