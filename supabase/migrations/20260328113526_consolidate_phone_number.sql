-- 1. Migrate existing data from phone_number to phone where phone is currently null
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'phone_number'
    ) THEN
        EXECUTE 'UPDATE public.users SET phone = phone_number WHERE phone IS NULL AND phone_number IS NOT NULL';
    END IF;
END $$;

-- 2. Drop the phone_number column from public.users
ALTER TABLE public.users
DROP COLUMN IF EXISTS phone_number;
