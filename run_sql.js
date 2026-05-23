import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function queryUsers() {
    console.log('Fetching all users...');
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, role, is_caregiver, status')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log(`Found ${data.length} users in public.users:`);
    console.table(data);

    const nonCaregivers = data.filter(u => u.is_caregiver !== true);
    console.log(`\nFound ${nonCaregivers.length} users with is_caregiver = false/null (these are hidden from the Caregiver table):`);
    console.table(nonCaregivers);
}

queryUsers().catch(console.error);
