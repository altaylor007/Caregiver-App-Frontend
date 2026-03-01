-- Add acknowledged_responsibilities column to users table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='users' AND column_name='acknowledged_responsibilities') THEN
        ALTER TABLE public.users ADD COLUMN acknowledged_responsibilities BOOLEAN DEFAULT false;
    END IF;
END $$;
