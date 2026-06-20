-- 1. Update shift_trades SELECT RLS policy
-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can read shift trades they are involved in" ON public.shift_trades;
DROP POLICY IF EXISTS "Anyone can read shift trades" ON public.shift_trades;

-- Create new SELECT policy allowing users to see their own trades and broadcast trades
CREATE POLICY "Users can read shift trades they are involved in or broadcast" ON public.shift_trades
FOR SELECT USING (
  auth.uid() = requested_by 
  OR auth.uid() = proposed_to 
  OR (proposed_to IS NULL AND auth.uid() IS NOT NULL)
);

-- 2. Add claim_shift_coverage RPC
CREATE OR REPLACE FUNCTION public.claim_shift_coverage(trade_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trade RECORD;
BEGIN
    -- Ensure caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Fetch the trade request
    SELECT * INTO v_trade
    FROM public.shift_trades
    WHERE id = trade_id;

    -- Validate existence
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trade request not found';
    END IF;

    -- Validate status is pending
    IF v_trade.status != 'pending' THEN
        RAISE EXCEPTION 'Trade is no longer pending';
    END IF;

    -- Validate proposed_to is NULL (broadcast request)
    IF v_trade.proposed_to IS NOT NULL THEN
        RAISE EXCEPTION 'Trade request is already claimed or not pending';
    END IF;

    -- Validate calling user is not requested_by (cannot claim own shift trade)
    IF v_trade.requested_by = auth.uid() THEN
        RAISE EXCEPTION 'Cannot claim your own shift trade request';
    END IF;

    -- Update the trade record: set proposed_to = auth.uid() and status = 'approved'
    UPDATE public.shift_trades
    SET proposed_to = auth.uid(),
        status = 'approved'
    WHERE id = trade_id;

    -- Update the shift: set assigned_to = auth.uid() on the related shift
    UPDATE public.shifts
    SET assigned_to = auth.uid()
    WHERE id = v_trade.shift_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_shift_coverage(uuid) TO authenticated;

-- 3. Add coverage_request notification type
-- Checked whether the notifications.type column has a CHECK constraint.
-- There is no CHECK constraint on public.notifications.type in the database (type is standard text),
-- so no table alteration is needed.
