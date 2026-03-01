-- Enable admins to update users table (needed for payroll toggle and status toggle)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' AND policyname = 'Admins can update users'
    ) THEN
        CREATE POLICY "Admins can update users" ON public.users FOR UPDATE USING (
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;
