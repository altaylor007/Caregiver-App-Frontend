-- Add trade_notes to shifts
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS trade_notes text;

-- Allow proposed_to user to read/update shift_trades
DROP POLICY IF EXISTS "Users can read shift trades they are involved in" ON public.shift_trades;
CREATE POLICY "Users can read shift trades they are involved in" ON public.shift_trades FOR SELECT USING (
  auth.uid() = requested_by OR auth.uid() = proposed_to
);

DROP POLICY IF EXISTS "Users can update shift trades they are proposed to" ON public.shift_trades;
CREATE POLICY "Users can update shift trades they are proposed to" ON public.shift_trades FOR UPDATE USING (
  auth.uid() = proposed_to
) WITH CHECK (
  auth.uid() = proposed_to
);

-- RPC for securely accepting a shift trade
-- Caregivers cannot normally update the assigned_to field of a shift,
-- so we need a security definer function to handle this logic safely.
CREATE OR REPLACE FUNCTION public.accept_shift_trade(trade_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trade RECORD;
    v_shift RECORD;
BEGIN
    -- Get the trade record
    SELECT * INTO v_trade FROM public.shift_trades WHERE id = trade_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trade request not found';
    END IF;

    -- ONLY the proposed user can accept
    IF v_trade.proposed_to != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized to accept this trade';
    END IF;

    IF v_trade.status != 'pending' THEN
        RAISE EXCEPTION 'Trade is not pending';
    END IF;

    -- Update the trade status
    UPDATE public.shift_trades
    SET status = 'approved'
    WHERE id = trade_id;

    -- Update the shift assignment and mark it as traded
    UPDATE public.shifts
    SET 
        assigned_to = v_trade.proposed_to,
        trade_notes = COALESCE(trade_notes, '') || ' [Trade accepted from caregiver]'
    WHERE id = v_trade.shift_id;
    
END;
$$;
