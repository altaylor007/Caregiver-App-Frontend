-- 1. Create a new storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for documents
-- Allow anyone (authenticated or public) to read documents
CREATE POLICY "Document files are publicly accessible."
ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' );

-- Allow admins to upload documents
CREATE POLICY "Admins can upload documents."
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'documents' AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Allow admins to update documents
CREATE POLICY "Admins can update documents."
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'documents' AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Allow admins to delete documents
CREATE POLICY "Admins can delete documents."
ON storage.objects FOR DELETE
USING (
    bucket_id = 'documents' AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 2. Create documents table (essentially replacing responsibilities)
CREATE TABLE IF NOT EXISTS public.documents (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL,
    file_url text,      -- The Supabase Storage public URL
    file_name text,     -- The original name of the file (e.g. employee_handbook.pdf)
    file_type text,     -- e.g. application/pdf, image/jpeg
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Documents RLS Policies
-- Anyone can read documents
CREATE POLICY "Anyone can read documents" ON public.documents FOR SELECT USING (true);
-- Only admins can manage documents
CREATE POLICY "Admins can manage documents" ON public.documents FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);


-- 3. Create document_acknowledgments table
CREATE TABLE IF NOT EXISTS public.document_acknowledgments (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(document_id, user_id) -- A user can only acknowledge a specific document once
);

ALTER TABLE public.document_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Document Acknowledgments RLS Policies
-- Admins can view all acknowledgments, users can view their own
CREATE POLICY "Users can view own acknowledgments, admins can view all" 
ON public.document_acknowledgments FOR SELECT 
USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Users can insert their own acknowledgments
CREATE POLICY "Users can insert own acknowledgments" 
ON public.document_acknowledgments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admins can delete acknowledgments (e.g., if re-acknowledgment is required)
CREATE POLICY "Admins can manage acknowledgments"
ON public.document_acknowledgments FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);


-- 4. Migrate existing data from responsibilities to documents
INSERT INTO public.documents (id, title, description, created_at, updated_at)
SELECT id, title, description, last_updated, last_updated
FROM public.responsibilities
ON CONFLICT (id) DO NOTHING;

-- Note: We are migrating old users' acknowledged_responsibilities status.
-- If a user had `acknowledged_responsibilities = true`, we assume they acknowledged 
-- all currently existing documents in the old system.
INSERT INTO public.document_acknowledgments (document_id, user_id, acknowledged_at)
SELECT d.id, u.id, timezone('utc'::text, now())
FROM public.users u
CROSS JOIN public.documents d
WHERE u.acknowledged_responsibilities = true
ON CONFLICT (document_id, user_id) DO NOTHING;

-- We can optionally deprecate the old table later, but we will leave it for now in case rollback is needed.
