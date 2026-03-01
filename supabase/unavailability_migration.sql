-- Refactoring time_off_requests to unavailability
DO $$
BEGIN
    -- Rename the table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='time_off_requests') THEN
        ALTER TABLE public.time_off_requests RENAME TO unavailability;
    END IF;

    -- Add the type column (full_day, morning, evening)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='unavailability' AND column_name='type') THEN
        ALTER TABLE public.unavailability ADD COLUMN type TEXT NOT NULL DEFAULT 'full_day';
    END IF;

    -- Note: start_date and end_date columns will remain the same. For single-day or half-day, start_date = end_date.
    -- The 'status' column is no longer strictly necessary (since it's not a request), but we'll leave it or set it to 'approved' by default in the app.
END $$;
