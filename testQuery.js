import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testQuery() {
    const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone, status, role, acknowledged_responsibilities, payroll_enabled')
        .eq('role', 'caregiver')
        .order('created_at', { ascending: false });

    console.log('Error:', error);
    console.log('Data:', data);
}
testQuery();
