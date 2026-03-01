-- Create policies for Managers (same as Admins) for the core tables

-- 1. SHIFTS
CREATE POLICY "Managers can manage shifts" ON public.shifts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);

-- 2. TIME OFF REQUESTS
CREATE POLICY "Managers can read all time off" ON public.time_off_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);
CREATE POLICY "Managers can update time off" ON public.time_off_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);

-- 3. AVAILABILITY REQUESTS/RESPONSES
CREATE POLICY "Managers full access on requests" ON public.availability_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);
CREATE POLICY "Managers full access on responses" ON public.availability_responses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);

-- 4. DOCUMENTS AND ACKNOWLEDGMENTS
CREATE POLICY "Managers can upload documents" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);
CREATE POLICY "Managers can update documents" ON storage.objects FOR UPDATE USING (
  bucket_id = 'documents' AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);
CREATE POLICY "Managers can delete documents" ON storage.objects FOR DELETE USING (
  bucket_id = 'documents' AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);
CREATE POLICY "Managers can manage documents" ON public.documents FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);
CREATE POLICY "Managers can manage acknowledgments" ON public.document_acknowledgments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);

-- 5. SHIFT TRADES
CREATE POLICY "Managers can update trades" ON public.shift_trades FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);

-- 6. PAYROLL REPORTS
CREATE POLICY "Managers can view all payroll reports" ON public.payroll_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);
CREATE POLICY "Managers can insert payroll reports" ON public.payroll_reports FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);

-- 7. USERS TABLE
-- Managers can update users (e.g. deactivate, change payroll status) just like admins,
-- BUT they cannot change the 'role' column. (Handled softly by frontend, but good to have)
CREATE POLICY "Managers can update users" ON public.users FOR UPDATE USING (
   EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
);
