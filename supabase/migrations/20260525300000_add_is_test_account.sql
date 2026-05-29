ALTER TABLE public.users ADD COLUMN is_test_account boolean NOT NULL DEFAULT false;

UPDATE public.users SET is_test_account = true WHERE email ILIKE 'test.%';
