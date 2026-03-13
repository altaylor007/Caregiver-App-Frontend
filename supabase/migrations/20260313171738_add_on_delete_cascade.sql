DO $$
BEGIN
  -- users
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
    ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- shifts
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shifts') THEN
    ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_assigned_to_fkey;
    ALTER TABLE public.shifts ADD CONSTRAINT shifts_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  -- availability
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'availability') THEN
    ALTER TABLE public.availability DROP CONSTRAINT IF EXISTS availability_user_id_fkey;
    ALTER TABLE public.availability ADD CONSTRAINT availability_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  -- time_off_requests
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'time_off_requests') THEN
    ALTER TABLE public.time_off_requests DROP CONSTRAINT IF EXISTS time_off_requests_user_id_fkey;
    ALTER TABLE public.time_off_requests ADD CONSTRAINT time_off_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  -- messages
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_author_id_fkey;
    ALTER TABLE public.messages ADD CONSTRAINT messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  -- shift_trades
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shift_trades') THEN
    ALTER TABLE public.shift_trades DROP CONSTRAINT IF EXISTS shift_trades_requested_by_fkey;
    ALTER TABLE public.shift_trades DROP CONSTRAINT IF EXISTS shift_trades_proposed_to_fkey;
    ALTER TABLE public.shift_trades DROP CONSTRAINT IF EXISTS shift_trades_shift_id_fkey;
    ALTER TABLE public.shift_trades ADD CONSTRAINT shift_trades_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE CASCADE;
    ALTER TABLE public.shift_trades ADD CONSTRAINT shift_trades_proposed_to_fkey FOREIGN KEY (proposed_to) REFERENCES public.users(id) ON DELETE CASCADE;
    ALTER TABLE public.shift_trades ADD CONSTRAINT shift_trades_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE CASCADE;
  END IF;

  -- unavailability
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'unavailability') THEN
    ALTER TABLE public.unavailability DROP CONSTRAINT IF EXISTS unavailability_user_id_fkey;
    ALTER TABLE public.unavailability ADD CONSTRAINT unavailability_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  -- availability_requests
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'availability_requests') THEN
    ALTER TABLE public.availability_requests DROP CONSTRAINT IF EXISTS availability_requests_created_by_fkey;
    ALTER TABLE public.availability_requests ADD CONSTRAINT availability_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  -- availability_responses
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'availability_responses') THEN
    ALTER TABLE public.availability_responses DROP CONSTRAINT IF EXISTS availability_responses_user_id_fkey;
    ALTER TABLE public.availability_responses ADD CONSTRAINT availability_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  -- sms_logs
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sms_logs') THEN
    ALTER TABLE public.sms_logs DROP CONSTRAINT IF EXISTS sms_logs_user_id_fkey;
    ALTER TABLE public.sms_logs ADD CONSTRAINT sms_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;
