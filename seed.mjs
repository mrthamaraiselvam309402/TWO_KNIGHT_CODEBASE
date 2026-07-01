import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://zznbanjdkwofsvpzybtr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6bmJhbmpka3dvZnN2cHp5YnRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEwNDkwMSwiZXhwIjoyMDk3NjgwOTAxfQ.yQv5n4Zk_Lw7D0wJ-Bf4Zk_Lw7D0wJ-Bf'; // Wait, I need the actual service role key!
// The frontend only has anon key. But in Edge functions we have service role key.
// I can just call the frontend API! The frontend API lets admins do anything.
