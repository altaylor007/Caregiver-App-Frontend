-- Add last_read_messages_at to track when a user last viewed the message board
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_read_messages_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure messages table is broadcasting realtime events so the unread badge can update instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
