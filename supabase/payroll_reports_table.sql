-- Create the payroll_reports table to save finalized reports
CREATE TABLE IF NOT EXISTS public.payroll_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    report_data JSONB NOT NULL DEFAULT '[]'::jsonb, -- Will hold array of { caregiver_id, name, total_hours }
    status TEXT NOT NULL DEFAULT 'confirmed'
);

-- Basic RLS
ALTER TABLE public.payroll_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all payroll reports" 
    ON public.payroll_reports 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert payroll reports" 
    ON public.payroll_reports 
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );
