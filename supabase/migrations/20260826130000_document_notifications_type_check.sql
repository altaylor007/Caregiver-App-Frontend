-- Drop the existing CHECK constraint if it exists
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Recreate the CHECK constraint with the full list of allowed notification types
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('mention', 'trade_request', 'trade_accepted', 'trade_rejected', 'coverage_request', 'schedule_broadcast', 'shift_trade'));
