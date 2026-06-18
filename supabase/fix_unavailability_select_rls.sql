-- Grants admin and manager roles SELECT access to public.unavailability.
-- Needed so the schedule conflict warning can read caregivers' time-off blocks.
-- Applied manually via Supabase SQL Editor on 2026-06-18. Additive, read-only, reversible.

DROP POLICY IF EXISTS "Admins and managers can view unavailability" ON public.unavailability;

CREATE POLICY "Admins and managers can view unavailability"
ON public.unavailability
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'manager')
  )
);
