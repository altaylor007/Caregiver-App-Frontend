-- Fix: Ensure caregivers can insert into shift_trades (trade request RLS)
-- Error was: "new row violates row-level security policy for table shift_trades"
-- The INSERT policy may be missing or misconfigured on the live database.

DROP POLICY IF EXISTS "Users can insert trades" ON public.shift_trades;

CREATE POLICY "Users can insert trades" ON public.shift_trades
FOR INSERT WITH CHECK (auth.uid() = requested_by);
