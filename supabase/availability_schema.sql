-- Table for admins to request availability coverage
CREATE TABLE IF NOT EXISTS public.availability_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    created_by UUID REFERENCES public.users(id) NOT NULL
);

-- Table for caregivers to respond with availability
CREATE TABLE IF NOT EXISTS public.availability_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('available', 'unavailable', 'preferred')),
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    UNIQUE(user_id, date)
);

-- Basic RLS
ALTER TABLE public.availability_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_responses ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "Admins full access on requests" ON public.availability_requests
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Admins full access on responses" ON public.availability_responses
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- Caregivers can view all requests
CREATE POLICY "Caregivers see requests" ON public.availability_requests
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'caregiver'));

-- Caregivers can manage their own responses
CREATE POLICY "Caregivers manage own responses" ON public.availability_responses
    FOR ALL USING (auth.uid() = user_id);

-- Realtime needs
ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_requests;
