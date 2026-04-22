const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function applyMigration() {
  const supabaseUrl = 'https://vseombfkrvpffnpgbsnk.supabase.co';
  
  // Try to get service role key from various sources
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        require('dotenv').config().parsed?.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    console.log('No service role key found in environment.');
    console.log('Please provide the SUPABASE_SERVICE_ROLE_KEY from your .env file:');
    console.log('  https://supabase.com/dashboard/project/vseombfkrvpffnpgbsnk/settings/api');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  const sql = fs.readFileSync('./supabase/migrations/20260422_add_attendance_table.sql', 'utf8');
  
  try {
    // Use the pg_platform SQL execution endpoint
    // Since supabase-js doesn't have direct SQL execution, we'll use the REST SQL endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        // This won't work - PostgREST doesn't execute arbitrary DDL
      })
    });
    
    console.log('Direct REST execution not possible. Need SQL editor.');
  } catch (err) {
    console.error(err.message);
  }
  
  // Output the SQL for manual execution
  console.log('\n========================================');
  console.log('MIGRATION SQL TO EXECUTE MANUALLY:');
  console.log('========================================\n');
  console.log(sql);
  console.log('\n========================================');
  console.log('Instructions:');
  console.log('1. Go to: https://supabase.com/dashboard/project/vseombfkrvpffnpgbsnk/sql');
  console.log('2. Create a new query');
  console.log('3. Paste the SQL above');
  console.log('4. Click "Run"');
  console.log('========================================');
}

// Load dotenv if available
try { require('dotenv').config(); } catch(e) {}

applyMigration();
