-- 1. Add preference column to public.users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS sms_only_mentions boolean DEFAULT false;

-- 2. Function to notify caregivers on all messages (who have sms_only_mentions = false)
CREATE OR REPLACE FUNCTION notify_caregivers_on_message() 
RETURNS TRIGGER AS $$
DECLARE
    project_url TEXT := 'YOUR_SUPABASE_PROJECT_URL'; -- Placeholder
    service_role_key TEXT := 'YOUR_SUPABASE_SERVICE_ROLE_KEY'; -- Placeholder
    has_individual_tags BOOLEAN;
    sender_name TEXT;
    topic_title TEXT;
    msg_snippet TEXT;
    sms_body TEXT;
    recipient RECORD;
    payload JSONB;
    request_id BIGINT;
BEGIN
    -- Check if the message contains individual tags but not @all
    has_individual_tags := (NEW.content ~* '@[a-zA-Z0-9]') AND (NOT NEW.content ~* '@all');

    -- If the message contains individual tags, do not send standard SMS broadcast 
    -- (the notification trigger will notify only the mentioned individuals)
    IF has_individual_tags = TRUE THEN
        RETURN NEW;
    END IF;

    -- Fetch sender name
    SELECT full_name INTO sender_name FROM public.users WHERE id = NEW.author_id;
    IF sender_name IS NULL THEN
        sender_name := 'A team member';
    END IF;

    -- Fetch topic title
    SELECT title INTO topic_title FROM public.message_topics WHERE id = NEW.topic_id;
    IF topic_title IS NULL THEN
        topic_title := 'General';
    END IF;

    -- Prepare message snippet (truncate to 100 characters)
    msg_snippet := substring(NEW.content from 1 for 100);
    IF length(NEW.content) > 100 THEN
        msg_snippet := msg_snippet || '...';
    END IF;

    -- Construct SMS message body
    sms_body := sender_name || ' posted in "' || topic_title || '": ' || msg_snippet;

    -- Loop over active caregivers with SMS enabled who want ALL messages
    FOR recipient IN 
        SELECT id FROM public.users 
        WHERE role = 'caregiver' 
          AND status = 'active' 
          AND sms_enabled = true 
          AND sms_only_mentions = false
          AND phone IS NOT NULL 
          AND id != NEW.author_id
    LOOP
        payload := jsonb_build_object(
            'userId', recipient.id,
            'messageBody', sms_body
        );

        SELECT net.http_post(
            url := project_url || '/functions/v1/send-sms',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            ),
            body := payload
        ) INTO request_id;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for all messages
DROP TRIGGER IF EXISTS trigger_notify_on_message ON public.messages;
CREATE TRIGGER trigger_notify_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION notify_caregivers_on_message();


-- 3. Function to notify caregivers on mentions (who have sms_only_mentions = true OR are mentioned in a message with individual tags)
CREATE OR REPLACE FUNCTION notify_caregiver_on_mention() 
RETURNS TRIGGER AS $$
DECLARE
    project_url TEXT := 'YOUR_SUPABASE_PROJECT_URL'; -- Placeholder
    service_role_key TEXT := 'YOUR_SUPABASE_SERVICE_ROLE_KEY'; -- Placeholder
    r_sms_enabled BOOLEAN;
    r_sms_only_mentions BOOLEAN;
    r_phone TEXT;
    sender_name TEXT;
    topic_title TEXT;
    msg_content TEXT;
    msg_author_id UUID;
    msg_topic_id UUID;
    msg_snippet TEXT;
    sms_body TEXT;
    payload JSONB;
    request_id BIGINT;
BEGIN
    -- Check if the notification is a mention
    IF NEW.type = 'mention' AND NEW.reference_id IS NOT NULL THEN
        -- Fetch recipient settings
        SELECT sms_enabled, sms_only_mentions, phone 
        INTO r_sms_enabled, r_sms_only_mentions, r_phone
        FROM public.users WHERE id = NEW.user_id;

        -- Only notify if the recipient has SMS enabled and phone set
        IF r_sms_enabled = true AND r_phone IS NOT NULL THEN
            
            -- Fetch the message content, author, and topic
            SELECT content, author_id, topic_id 
            INTO msg_content, msg_author_id, msg_topic_id
            FROM public.messages WHERE id = NEW.reference_id;

            -- Trigger SMS if user wants mentions only, OR if the message contains individual tags 
            -- (since the message trigger will have skipped them to prevent spam)
            IF r_sms_only_mentions = true OR (msg_content ~* '@all') = false THEN

                -- Fetch sender name
                SELECT full_name INTO sender_name FROM public.users WHERE id = msg_author_id;
                IF sender_name IS NULL THEN
                    sender_name := 'A team member';
                END IF;

                -- Fetch topic title
                SELECT title INTO topic_title FROM public.message_topics WHERE id = msg_topic_id;
                IF topic_title IS NULL THEN
                    topic_title := 'General';
                END IF;

                -- Prepare message snippet (truncate to 100 characters)
                msg_snippet := substring(msg_content from 1 for 100);
                IF length(msg_content) > 100 THEN
                    msg_snippet := msg_snippet || '...';
                END IF;

                -- Construct SMS body
                sms_body := 'Tagged by ' || sender_name || ' in "' || topic_title || '": ' || msg_snippet;

                -- Send the POST request to the send-sms Edge Function
                payload := jsonb_build_object(
                    'userId', NEW.user_id,
                    'messageBody', sms_body
                );

                SELECT net.http_post(
                    url := project_url || '/functions/v1/send-sms',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || service_role_key
                    ),
                    body := payload
                ) INTO request_id;

            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for mentions
DROP TRIGGER IF EXISTS trigger_notify_on_mention ON public.notifications;
CREATE TRIGGER trigger_notify_on_mention
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION notify_caregiver_on_mention();
