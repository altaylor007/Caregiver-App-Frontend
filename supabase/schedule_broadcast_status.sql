-- Adds a status column to schedule_broadcasts for withdraw/archive.
-- Applied to production via SQL Editor 2026-06-20.
ALTER TABLE public.schedule_broadcasts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','withdrawn','archived'));
