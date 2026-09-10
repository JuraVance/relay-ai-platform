import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials in .env');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test connection
export const testConnection = async () => {
  const { data, error } = await supabase
    .from('dealers')
    .select('name, location')
    .limit(1);

  if (error) {
    console.error('❌ Supabase connection failed:', error.message);
    return false;
  }

  console.log('✅ Supabase connected. Dealer:', data[0]?.name);
  return true;
};