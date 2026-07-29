import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const commercialDemo = import.meta.env.DEV
  && typeof window !== 'undefined'
  && window.location.pathname === '/planos'
  && new URLSearchParams(window.location.search).get('demo') === '1';
const testRuntime = import.meta.env.MODE === 'test';

// The local commercial demo never performs network requests. Placeholder values
// let designers test the editor without copying production credentials.
const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurationAvailable = Boolean(
  (configuredUrl && configuredAnonKey) || commercialDemo || testRuntime,
);

// Creating the client with inert local values keeps public routes renderable when
// configuration is missing. Auth actions remain disabled until real public values
// are available, so a configuration mistake cannot turn the Login into a blank page.
const supabaseUrl = configuredUrl || 'http://127.0.0.1:54321';
const supabaseAnonKey = configuredAnonKey || 'local-unconfigured-publishable-key';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'tcs-dashboard-auth',
  },
});
