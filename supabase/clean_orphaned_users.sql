-- This script identifies and deletes records in the `auth.users` table
-- that no longer have a corresponding record in the `public.users` table.

-- This typically happens when a user is manually deleted from the `public.users` Table Editor,
-- which leaves the row in `auth.users` behind, preventing a new account with that email from being created.

BEGIN;

-- 1. (Optional Verification) See which emails are orphaned before deleting them
-- Uncomment the line below to view the orphaned emails before running the DELETE statement:
-- SELECT id, email FROM auth.users WHERE id NOT IN (SELECT id FROM public.users);

-- 2. Delete the orphaned auth records safely
DELETE FROM auth.users 
WHERE id IN (
  SELECT au.id 
  FROM auth.users au
  LEFT JOIN public.users pu ON au.id = pu.id
  WHERE pu.id IS NULL
);

COMMIT;
