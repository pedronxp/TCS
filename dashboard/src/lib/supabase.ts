import { createClient } from '@supabase/supabase-js';

const commercialDemo = import.meta.env.DEV
  && typeof window !== 'undefined'
  && window.location.pathname === '/planos'
  && new URLSearchParams(window.location.search).get('demo') === '1';

// The local commercial demo never performs network requests. Placeholder values
// let designers test the editor without copying production credentials.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (commercialDemo ? 'http://127.0.0.1:54321' : '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (commercialDemo ? 'commercial-demo-public-key' : '');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env do dashboard'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'tcs-dashboard-auth',
  },
});
