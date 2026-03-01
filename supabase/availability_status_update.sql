-- Drop the existing CHECK constraint so we can allow new granular statuses
ALTER TABLE public.availability_responses
DROP CONSTRAINT IF EXISTS availability_responses_status_check;

-- Add the new CHECK constraint that includes 'available', 'unavailable', 'preferred', 'available_morning', 'available_evening'
ALTER TABLE public.availability_responses
ADD CONSTRAINT availability_responses_status_check 
CHECK (status IN ('available', 'unavailable', 'preferred', 'available_morning', 'available_evening'));
