-- Fix the users_role_check constraint to include 'manager'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role in ('admin', 'caregiver', 'manager'));
