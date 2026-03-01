-- Adds missing columns that the frontend expects in the AdminCaregiversPage
DO $$
BEGIN
    -- Add status column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='users' AND column_name='status') THEN
        ALTER TABLE public.users ADD COLUMN status TEXT DEFAULT 'active';
    END IF;

    -- Add payroll_enabled column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='users' AND column_name='payroll_enabled') THEN
        ALTER TABLE public.users ADD COLUMN payroll_enabled BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
