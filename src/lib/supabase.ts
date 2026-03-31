import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Cliente Supabase conectado al Cerebro Administrativo (AMIS 3.0)
export const supabase = createClient(
  supabaseUrl || 'https://undefined.supabase.co', 
  supabaseAnonKey || 'undefined', 
  {
    auth: {
      persistSession: false // This is a server-side read-only client for the RIS
    }
  }
);
