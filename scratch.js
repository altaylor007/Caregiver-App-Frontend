import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY)
async function main() {
  const { data } = await supabase.from('payroll_reports').select('id, start_date, end_date')
  console.log(data)
}
main()
