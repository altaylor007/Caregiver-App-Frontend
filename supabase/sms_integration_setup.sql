-- Add SMS fields to the users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS sms_enabled boolean DEFAULT false;

-- Create an SMS Logs table to track messages
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id),
    phone_number text NOT NULL,
    direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
    message_body text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    provider_id text, -- Twilio Message SID
    error_message text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on the logs table
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs. Users can read their own.
DROP POLICY IF EXISTS "Admins can read all sms logs" ON public.sms_logs;
CREATE POLICY "Admins can read all sms logs" ON public.sms_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Users can read own sms logs" ON public.sms_logs;
CREATE POLICY "Users can read own sms logs" ON public.sms_logs FOR SELECT USING (auth.uid() = user_id);

-- Only edge functions (service role) should insert logs usually, but we can allow admins for testing
DROP POLICY IF EXISTS "Admins can insert sms logs" ON public.sms_logs;
CREATE POLICY "Admins can insert sms logs" ON public.sms_logs FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
