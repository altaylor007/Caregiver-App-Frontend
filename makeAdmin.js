import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function makeAdmin() {
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', 'john.smith@example.com');

    if (userError || !userData || userData.length === 0) {
        console.log('User not found or error:', userError);
        return;
    }

    const userId = userData[0].id;
    const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('id', userId);

    if (updateError) {
        console.log('Error updating user:', updateError);
    } else {
        console.log('User role updated to admin successfully.');
    }
}
makeAdmin();
