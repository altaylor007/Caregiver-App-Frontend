import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testUpsert() {
    const { data: userData } = await supabase.from('users').select('id').eq('email', 'john.smith@example.com');

    if (!userData) return;
    const userId = userData[0].id;

    const { data, error } = await supabase
        .from('availability_responses')
        .upsert({ user_id: userId, date: '2026-03-01', status: 'available' }, { onConflict: 'user_id,date' });

    console.log('Error:', error);
}
testUpsert();
