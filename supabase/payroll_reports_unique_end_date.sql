-- Enforce that only one confirmed payroll report per week-ending date can exist
ALTER TABLE public.payroll_reports
ADD CONSTRAINT payroll_reports_unique_end_date UNIQUE (end_date);
