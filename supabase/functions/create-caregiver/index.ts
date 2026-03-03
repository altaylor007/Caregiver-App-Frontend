import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
    const { email, fullName, password } = await req.json();

    if (!email || !fullName) {
      throw new Error('Email and Full Name are required');
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

    // 1. Create the user in the auth.users table
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password || 'Agnes2026',
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      throw authError;
    }

    const userId = authData.user.id;

    // 2. Update the user profile in the public.users table (trigger inserts it shortly after)
    // Set their role, requires_password_change flag, and full name.
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .update({
        full_name: fullName,
        role: 'caregiver',
        requires_password_change: true,
      })
      .eq('id', userId);

    if (profileError) {
      throw profileError;
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
