-- service_role_key is read at runtime from Supabase Vault (secret name: 'service_role_key').
-- Create the secret once in the SQL Editor before running this:
--   SELECT vault.create_secret('<service role JWT>', 'service_role_key', 'SMS notify triggers');
-- No real key is stored in this file.

CREATE OR REPLACE FUNCTION public.notify_caregivers_on_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    project_url TEXT := 'https://xbyfhfwjwbpqzghbnkih.supabase.co';
    service_role_key TEXT;
    has_individual_tags BOOLEAN;
    sender_name TEXT;
    topic_title TEXT;
    msg_snippet TEXT;
    sms_body TEXT;
    recipient RECORD;
    payload JSONB;
    request_id BIGINT;
BEGIN
    has_individual_tags := (NEW.content ~* '@[a-zA-Z0-9]') AND (NOT NEW.content ~* '@all');

    IF has_individual_tags = TRUE THEN
        RETURN NEW;
    END IF;

    SELECT full_name INTO sender_name FROM public.users WHERE id = NEW.author_id;
    IF sender_name IS NULL THEN
        sender_name := 'A team member';
    END IF;

    SELECT title INTO topic_title FROM public.message_topics WHERE id = NEW.topic_id;
    IF topic_title IS NULL THEN
        topic_title := 'General';
    END IF;

    msg_snippet := substring(NEW.content from 1 for 100);
    IF length(NEW.content) > 100 THEN
        msg_snippet := msg_snippet || '...';
    END IF;

    IF NEW.image_url IS NOT NULL THEN
        sms_body := sender_name || ' posted in "' || topic_title || '": ' || msg_snippet || ' 📎 This message includes an image. View it here: https://radiant-yeot-a82a87.netlify.app/messages?topic=' || NEW.topic_id::text;
    ELSE
        sms_body := sender_name || ' posted in "' || topic_title || '": ' || msg_snippet || ' View it here: https://radiant-yeot-a82a87.netlify.app/messages?topic=' || NEW.topic_id::text;
    END IF;

    BEGIN
        SELECT decrypted_secret INTO service_role_key
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_caregivers_on_message: could not read service_role_key from vault: %', SQLERRM;
        RETURN NEW;
    END;
    IF service_role_key IS NULL THEN
        RAISE WARNING 'notify_caregivers_on_message: service_role_key not found in vault';
        RETURN NEW;
    END IF;

    FOR recipient IN 
        SELECT id FROM public.users 
        WHERE (role = 'caregiver' OR is_caregiver = true)
          AND status = 'active' 
          AND sms_enabled = true 
          AND sms_only_mentions = false
          AND phone IS NOT NULL 
          AND id != NEW.author_id
    LOOP
        BEGIN
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
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'notify_caregivers_on_message: SMS failed for user %: %', recipient.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN NEW;
END;
$function$;

---

CREATE OR REPLACE FUNCTION public.notify_caregiver_on_mention()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    project_url TEXT := 'https://xbyfhfwjwbpqzghbnkih.supabase.co';
    service_role_key TEXT;
    r_sms_enabled BOOLEAN;
    r_sms_only_mentions BOOLEAN;
    r_phone TEXT;
    sender_name TEXT;
    topic_title TEXT;
    msg_content TEXT;
    msg_image_url TEXT;
    msg_author_id UUID;
    msg_topic_id UUID;
    msg_snippet TEXT;
    sms_body TEXT;
    payload JSONB;
    request_id BIGINT;
BEGIN
    IF NEW.type = 'mention' AND NEW.reference_id IS NOT NULL THEN
        SELECT sms_enabled, sms_only_mentions, phone 
        INTO r_sms_enabled, r_sms_only_mentions, r_phone
        FROM public.users WHERE id = NEW.user_id;

        IF r_sms_enabled = true AND r_phone IS NOT NULL THEN
            
            SELECT content, author_id, topic_id, image_url
            INTO msg_content, msg_author_id, msg_topic_id, msg_image_url
            FROM public.messages WHERE id = NEW.reference_id;

            IF r_sms_only_mentions = true OR (msg_content ~* '@all') = false THEN

                SELECT full_name INTO sender_name FROM public.users WHERE id = msg_author_id;
                IF sender_name IS NULL THEN
                    sender_name := 'A team member';
                END IF;

                SELECT title INTO topic_title FROM public.message_topics WHERE id = msg_topic_id;
                IF topic_title IS NULL THEN
                    topic_title := 'General';
                END IF;

                msg_snippet := substring(msg_content from 1 for 100);
                IF length(msg_content) > 100 THEN
                    msg_snippet := msg_snippet || '...';
                END IF;

                IF msg_image_url IS NOT NULL THEN
                    sms_body := 'Tagged by ' || sender_name || ' in "' || topic_title || '": ' || msg_snippet || ' 📎 This message includes an image. View it here: https://radiant-yeot-a82a87.netlify.app/messages?topic=' || msg_topic_id::text;
                ELSE
                    sms_body := 'Tagged by ' || sender_name || ' in "' || topic_title || '": ' || msg_snippet || ' View it here: https://radiant-yeot-a82a87.netlify.app/messages?topic=' || msg_topic_id::text;
                END IF;

                BEGIN
                    SELECT decrypted_secret INTO service_role_key
                    FROM vault.decrypted_secrets
                    WHERE name = 'service_role_key';
                EXCEPTION WHEN OTHERS THEN
                    RAISE WARNING 'notify_caregiver_on_mention: could not read service_role_key from vault: %', SQLERRM;
                    RETURN NEW;
                END;
                IF service_role_key IS NULL THEN
                    RAISE WARNING 'notify_caregiver_on_mention: service_role_key not found in vault';
                    RETURN NEW;
                END IF;

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
$function$;
