-- Add DELETE policy so admins can reinstate (delete) confirmed payroll reports
CREATE POLICY "Admins can delete payroll reports"
    ON public.payroll_reports
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );
