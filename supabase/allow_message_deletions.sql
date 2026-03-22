-- Add DELETE policy for message_topics so admins can delete entire threads
CREATE POLICY "Admins can delete topics"
    ON public.message_topics
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Add DELETE policy for messages so authors can delete their own, or admins can delete any
CREATE POLICY "Users can delete their own messages or admins can delete any"
    ON public.messages
    FOR DELETE
    USING (
        auth.uid() = author_id
        OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );
