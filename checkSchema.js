import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
    const { data, error } = await supabase.rpc('get_columns_for_table', { table_name: 'users' });

    if (error) {
        // If RPC doesn't exist, fallback to a raw query which is not possible directly via client, 
        // but we can just test selecting each column individually to see if they exist.
        const columns = ['id', 'email', 'full_name', 'role', 'phone', 'status', 'acknowledged_responsibilities', 'payroll_enabled'];
        for (const col of columns) {
            const { error: colErr } = await supabase.from('users').select(col).limit(1);
            console.log(`Column ${col}:`, colErr ? colErr.message : 'EXISTS');
        }
    }
}
checkSchema();
