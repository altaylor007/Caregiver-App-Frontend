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
        // Manually verify JWT so CORS OPTIONS requests don't fail at the gateway
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing Authorization header');
        }

        // Initialize Supabase admin client with service role key to bypass RLS
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_JWT') ?? '';

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

        const { userId, email, phone, password } = await req.json();

        if (!userId) throw new Error('userId is required');

        // Prepare auth update payload
        const authUpdatePayload: any = {};
        if (password !== undefined && password !== null) authUpdatePayload.password = password;
        if (email) authUpdatePayload.email = email;
        if (phone) authUpdatePayload.phone = phone;

        // 1. Update the user email, phone, password in auth.users
        if (Object.keys(authUpdatePayload).length > 0) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdatePayload);

            if (authError) {
                throw authError;
            }
        }

        // 2. Update their email and phone in public.users, and set requires_password_change
        const usersUpdatePayload: any = { requires_password_change: true };
        if (email) usersUpdatePayload.email = email;
        if (phone) usersUpdatePayload.phone = phone;

        const { error: profileError } = await supabaseAdmin
            .from('users')
            .update(usersUpdatePayload)
            .eq('id', userId);

        if (profileError) {
            throw profileError;
        }

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
