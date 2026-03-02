-- Migration to add targeted user requests

-- Add the target_user_ids array to availability_requests
ALTER TABLE public.availability_requests 
ADD COLUMN IF NOT EXISTS target_user_ids UUID[] DEFAULT NULL;

-- Drop the existing policy 
DROP POLICY IF EXISTS "Caregivers see requests" ON public.availability_requests;

-- Recreate the policy with array filtering
-- Caregivers can view a request if the target_user_ids is NULL, an empty array, or if their auth.uid() is in the array
CREATE POLICY "Caregivers see requests" ON public.availability_requests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'caregiver')
        AND (
            target_user_ids IS NULL 
            OR array_length(target_user_ids, 1) IS NULL 
            OR auth.uid() = ANY(target_user_ids)
        )
    );
