-- Create schedule_broadcasts table
CREATE TABLE public.schedule_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on schedule_broadcasts
ALTER TABLE public.schedule_broadcasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_broadcasts
CREATE POLICY "Authenticated users can select schedule_broadcasts"
ON public.schedule_broadcasts
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and managers can manage schedule_broadcasts"
ON public.schedule_broadcasts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
);

-- Create schedule_acknowledgments table
CREATE TABLE public.schedule_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.schedule_broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('acknowledged', 'flagged')),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(broadcast_id, user_id)
);

-- Enable RLS on schedule_acknowledgments
ALTER TABLE public.schedule_acknowledgments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_acknowledgments
CREATE POLICY "Users can select own acknowledgments, admins and managers can select all"
ON public.schedule_acknowledgments
FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Users can insert own acknowledgments"
ON public.schedule_acknowledgments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Users can update own acknowledgments, admins and managers can update all"
ON public.schedule_acknowledgments
FOR UPDATE
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can delete acknowledgments"
ON public.schedule_acknowledgments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
);

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_acknowledgments;
