const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runMigration() {
  try {
    const sql = fs.readFileSync('./supabase/migrations/20260422_add_attendance_table.sql', 'utf8');
    
    // Use RPC to execute raw SQL (service role bypasses RLS)
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      // Exec RPC might not exist, try using the postgrest endpoint directly via fetch
      console.log('RPC method failed, trying direct execution...');
      throw error;
    }
    
    console.log('Migration successful:', data);
  } catch (error) {
    console.error('Migration failed:', error.message);
    
    // Fallback: Use psql-style execution via HTTP
    // Since we can't exec directly, output instructions
    console.log('\n=== MANUAL EXECUTION REQUIRED ===');
    console.log('Run this SQL in Supabase Dashboard SQL Editor:');
    console.log('==========================================');
    console.log(sql);
    console.log('==========================================');
    process.exit(1);
  }
}

runMigration();
