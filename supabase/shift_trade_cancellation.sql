-- Adds 'cancelled' status to shift_trades and lets a requester cancel their own
-- pending trade. Applied to production via SQL Editor 2026-06-20.
ALTER TABLE public.shift_trades
  DROP CONSTRAINT IF EXISTS shift_trades_status_check;
ALTER TABLE public.shift_trades
  ADD CONSTRAINT shift_trades_status_check
  CHECK (status IN ('pending','approved','denied','cancelled'));

DROP POLICY IF EXISTS "Requester can cancel own pending trade" ON public.shift_trades;
CREATE POLICY "Requester can cancel own pending trade"
  ON public.shift_trades
  FOR UPDATE
  TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending')
  WITH CHECK (requested_by = auth.uid() AND status = 'cancelled');
