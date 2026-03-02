-- Enforce that only 'admin' can change the 'role' column in the 'users' table.

CREATE OR REPLACE FUNCTION public.check_role_update_permission()
RETURNS TRIGGER AS $$
DECLARE
  current_user_role text;
BEGIN
  -- Only execute if the role is actually being changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Get the role of the user performing the update
    SELECT role INTO current_user_role
    FROM public.users
    WHERE id = auth.uid();

    -- Check if the performing user is an admin
    IF current_user_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: Only admins can change user roles.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists to allow for re-running the script safely
DROP TRIGGER IF EXISTS enforce_admin_role_assignment_trigger ON public.users;

-- Create the trigger on the users table
CREATE TRIGGER enforce_admin_role_assignment_trigger
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.check_role_update_permission();
