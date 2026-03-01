-- Add 'notes' column to availability_responses
ALTER TABLE public.availability_responses ADD COLUMN IF NOT EXISTS notes text;
