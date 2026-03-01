-- Add requires_acknowledgment boolean column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='documents' AND column_name='requires_acknowledgment') THEN
        ALTER TABLE public.documents ADD COLUMN requires_acknowledgment BOOLEAN DEFAULT TRUE NOT NULL;
    END IF;
END $$;
