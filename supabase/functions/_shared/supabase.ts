import { createClient } from 'jsr:@supabase/supabase-js@2'

export const supabaseClient = createClient(
    // Supabase automatically provides these environment variables to Edge Functions
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
        global: {
            headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` }
        }
    }
)
