import { createClient } from 'jsr:@supabase/supabase-js@2'

// Service-role client for Edge Functions.
// PostgREST authenticates the DB role from the JWT in the Authorization header.
// This project's SUPABASE_SERVICE_ROLE_KEY is the new sb_secret_… format (not a JWT),
// which PostgREST rejects ("Expected 3 parts in JWT"). So we use the legacy JWT-format
// service_role key, provided via the SERVICE_ROLE_JWT secret — PostgREST accepts it and
// it bypasses RLS.
export const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SERVICE_ROLE_JWT') ?? '',
    {
        auth: { persistSession: false, autoRefreshToken: false }
    }
)
