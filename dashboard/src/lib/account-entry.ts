import { supabase } from '@/lib/supabase';

export async function fetchAuthenticatedInternalProfile(): Promise<unknown | null> {
  const result = await supabase.rpc('get_internal_staff_profile');
  return result.error ? null : result.data;
}
