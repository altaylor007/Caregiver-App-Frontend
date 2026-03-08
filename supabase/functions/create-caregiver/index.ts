import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Set CORS headers so the browser can make requests to this function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Manually verify JWT so CORS OPTIONS requests don't fail at the gateway
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    // Initialize Supabase admin client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check JWT validity 
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      throw new Error('Invalid JWT: Unauthorized');
    }

    const { email, firstName, lastName, password } = await req.json();
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    // 1. Create the user in the auth.users table
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password || 'Agnes2026',
      email_confirm: true,
      user_metadata: { full_name: fullName, first_name: firstName, last_name: lastName },
    });

    if (authError) {
      throw authError;
    }

    const userId = authData.user.id;

    // 2. Update the user profile in the public.users table (trigger inserts it shortly after)
    // Add a retry loop because the database trigger might take a few milliseconds to insert the row
    let profileUpdated = false;
    let lastError = null;

    for (let attempts = 0; attempts < 5; attempts++) {
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .update({
          full_name: fullName,
          first_name: firstName || null,
          last_name: lastName || null,
          role: 'caregiver',
          is_caregiver: true,
          requires_password_change: true,
        })
        .eq('id', userId);

      if (!profileError) {
        profileUpdated = true;
        break;
      }

      lastError = profileError;
      await wait(500); // Wait 500ms before retrying
    }

    if (!profileUpdated) {
      throw lastError || new Error("Failed to update user profile after multiple attempts.");
    }

    return new Response(
      JSON.stringify({ success: true, user: authData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
