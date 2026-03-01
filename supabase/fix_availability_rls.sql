-- Fix the caregiver availability responses RLS policy
-- The current policy is: CREATE POLICY "Caregivers manage own responses" ON public.availability_responses FOR ALL USING (auth.uid() = user_id);
-- For INSERT and UPDATE (upsert), we need a WITH CHECK clause to ensure the new row satisfies the condition.

DROP POLICY IF EXISTS "Caregivers manage own responses" ON public.availability_responses;

CREATE POLICY "Caregivers manage own responses" ON public.availability_responses
    FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
