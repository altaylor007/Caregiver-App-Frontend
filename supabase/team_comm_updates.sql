-- 1. Create Message Topics
CREATE TABLE IF NOT EXISTS public.message_topics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.message_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Topics are viewable by everyone." 
ON public.message_topics FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Topics are insertable by authenticated users." 
ON public.message_topics FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create a Default Topic for existing messages to attach to
INSERT INTO public.message_topics (id, title) 
VALUES ('11111111-1111-1111-1111-111111111111', 'General Discussion') 
ON CONFLICT DO NOTHING;

-- 2. Update Messages Table to link to Topics
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.message_topics(id) DEFAULT '11111111-1111-1111-1111-111111111111';

-- 3. Create Message Reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions are viewable by everyone." 
ON public.message_reactions FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can add their own reactions." 
ON public.message_reactions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions." 
ON public.message_reactions FOR DELETE 
USING (auth.uid() = user_id);

-- 4. Create Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g., 'mention', 'responsibility'
    reference_id UUID, -- e.g., the message_id or shift_id
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications." 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications." 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert notifications." 
ON public.notifications FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);
