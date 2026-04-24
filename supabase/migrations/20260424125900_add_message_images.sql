-- Add image_url to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for message-attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']::text[]
) ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
-- Allow anyone to read attachments
CREATE POLICY "Public Read Access for message-attachments" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'message-attachments' );

-- Allow authenticated users to upload new attachments
CREATE POLICY "Authenticated Upload Access for message-attachments" 
ON storage.objects FOR INSERT 
WITH CHECK ( 
  bucket_id = 'message-attachments' AND 
  auth.role() = 'authenticated'
);
