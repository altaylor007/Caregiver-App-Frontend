-- RPC for a caregiver to securely claim an open shift
-- Caregivers cannot normally update the assigned_to field of a shift,
-- so we need a security definer function to handle this logic safely.
CREATE OR REPLACE FUNCTION public.claim_open_shift(shift_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift RECORD;
BEGIN
    -- Get the shift record
    SELECT * INTO v_shift FROM public.shifts WHERE id = shift_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shift not found';
    END IF;

    -- ONLY open shifts can be claimed
    IF NOT (v_shift.is_open = true AND v_shift.assigned_to IS NULL AND v_shift.custom_assigned_name IS NULL) THEN
        RAISE EXCEPTION 'Shift is not available to be claimed';
    END IF;

    -- Ensure caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Update the shift assignment and mark it as no longer open
    UPDATE public.shifts
    SET 
        assigned_to = auth.uid(),
        is_open = false
    WHERE id = shift_uuid;
    
END;
$$;
