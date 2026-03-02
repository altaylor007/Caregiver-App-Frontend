import { createClient } from '@supabase/supabase-js';

// Admin client uses the service role key — bypasses RLS.
// ⚠️ LOCAL USE ONLY — never commit the service role key to GitHub.
const supabaseAdmin = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'dummy_key_to_prevent_crash'
);

export { supabaseAdmin };
