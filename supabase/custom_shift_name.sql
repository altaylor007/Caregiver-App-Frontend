-- Add custom_assigned_name column to shifts table for one-off/emergency caregivers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='shifts' AND column_name='custom_assigned_name') THEN
        ALTER TABLE public.shifts ADD COLUMN custom_assigned_name TEXT;
    END IF;
END $$;
