-- Add status column to users table if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='users' AND column_name='status') THEN
        ALTER TABLE public.users ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;
