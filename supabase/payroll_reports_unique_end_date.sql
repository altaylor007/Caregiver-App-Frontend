-- Remove duplicate payroll reports (keep only the most recent per end_date)
DELETE FROM public.payroll_reports
WHERE id NOT IN (
    SELECT DISTINCT ON (end_date) id
    FROM public.payroll_reports
    ORDER BY end_date, generated_at DESC
);

-- Now enforce uniqueness so this can't happen again
ALTER TABLE public.payroll_reports
ADD CONSTRAINT payroll_reports_unique_end_date UNIQUE (end_date);
