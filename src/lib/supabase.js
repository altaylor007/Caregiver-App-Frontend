import { createClient } from '@supabase/supabase-js';

// These should normally come from process.env, 
// For this demo, we can instruct the user to provide them or use placeholders
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storageKey: 'act-app-auth-token', // Bypasses previous broken local storage locks
    }
});
