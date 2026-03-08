ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Backfill existing records
UPDATE public.users 
SET 
  first_name = split_part(full_name, ' ', 1),
  last_name = CASE 
    WHEN strpos(full_name, ' ') > 0 THEN substr(full_name, strpos(full_name, ' ') + 1)
    ELSE ''
  END
WHERE full_name IS NOT NULL AND first_name IS NULL;
