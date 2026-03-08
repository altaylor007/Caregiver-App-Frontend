-- Add is_caregiver flag to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_caregiver BOOLEAN DEFAULT false;

-- Initialize existing caregivers to true
UPDATE public.users SET is_caregiver = true WHERE role = 'caregiver';

-- Assuming any manager that is currently active might want to be a caregiver
-- By default we'll set it to false for managers/admins to let them opt-in, 
-- but you mentioned "Shelly Easton as manager only and not on the caregiver list",
-- which implies she shouldn't be on the list.
-- So keeping it false for managers and admins is correct.
