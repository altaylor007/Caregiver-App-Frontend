-- Add 'notes' column to availability_responses
ALTER TABLE public.availability_responses ADD COLUMN IF NOT EXISTS notes text;

-- Drop the existing CHECK constraint so we can allow new granular statuses
ALTER TABLE public.availability_responses
DROP CONSTRAINT IF EXISTS availability_responses_status_check;

-- Add the new CHECK constraint that includes 'available', 'unavailable', 'preferred', 'available_morning', 'available_evening'
ALTER TABLE public.availability_responses
ADD CONSTRAINT availability_responses_status_check 
CHECK (status IN ('available', 'unavailable', 'preferred', 'available_morning', 'available_evening'));

-- Fix the caregiver availability responses RLS policy
-- For INSERT and UPDATE (upsert), we need a WITH CHECK clause to ensure the new row satisfies the condition.

DROP POLICY IF EXISTS "Caregivers manage own responses" ON public.availability_responses;

CREATE POLICY "Caregivers manage own responses" ON public.availability_responses
    FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
