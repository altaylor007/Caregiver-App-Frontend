-- Add payroll_report_contact flag to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS payroll_report_contact BOOLEAN DEFAULT false;
