-- 1. Migrate existing data from phone_number to phone where phone is currently null
UPDATE public.users
SET phone = phone_number
WHERE phone IS NULL AND phone_number IS NOT NULL;

-- 2. Drop the phone_number column from public.users
ALTER TABLE public.users
DROP COLUMN phone_number;
