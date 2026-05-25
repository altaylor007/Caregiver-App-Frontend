-- Create trigger function to notify caregivers of open/broadcast coverage requests
CREATE OR REPLACE FUNCTION public.notify_caregivers_on_coverage_request()
RETURNS TRIGGER AS $$
DECLARE
    r_recipient RECORD;
BEGIN
    -- Loop over active caregivers and dual-role users (admin/manager who also work shifts)
    -- excluding the initiator of the trade request
    FOR r_recipient IN
        SELECT id FROM public.users
        WHERE status = 'active'
          AND (role = 'caregiver' OR is_caregiver = true)
          AND id != NEW.requested_by
    LOOP
        INSERT INTO public.notifications (user_id, actor_id, type, reference_id, is_read)
        VALUES (r_recipient.id, NEW.requested_by, 'coverage_request', NEW.shift_id, false);
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_notify_on_coverage_request ON public.shift_trades;

-- Create the trigger on shift_trades
CREATE TRIGGER trigger_notify_on_coverage_request
AFTER INSERT ON public.shift_trades
FOR EACH ROW
WHEN (NEW.proposed_to IS NULL)
EXECUTE FUNCTION public.notify_caregivers_on_coverage_request();
