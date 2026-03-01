-- Enable payroll tracking for specific users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='payroll_enabled') THEN
        ALTER TABLE public.users ADD COLUMN payroll_enabled BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
