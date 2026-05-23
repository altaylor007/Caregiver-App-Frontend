-- Allow managers to view payroll reports
CREATE POLICY "Managers can view all payroll reports" 
    ON public.payroll_reports 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'manager'
        )
    );

-- Allow managers to insert payroll reports
CREATE POLICY "Managers can insert payroll reports" 
    ON public.payroll_reports 
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'manager'
        )
    );

-- Allow managers to delete payroll reports
CREATE POLICY "Managers can delete payroll reports"
    ON public.payroll_reports
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'manager'
        )
    );
