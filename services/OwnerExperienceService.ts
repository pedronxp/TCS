import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

export type OwnerExperienceMode = 'follow' | 'operate';
export const isOwnerExperienceMode = (value: unknown): value is OwnerExperienceMode => value === 'follow' || value === 'operate';
const cacheKey = (uid: string) => `@owner_mobile_experience:${uid}`;

export async function loadOwnerExperience(uid: string, role: string): Promise<{ mode: OwnerExperienceMode | null; source: 'server' | 'cache' }> {
  if (role !== 'owner') throw new Error('Acesso exclusivo do proprietário.');
  try {
    const { data, error } = await supabase.rpc('get_owner_mobile_experience');
    if (error) throw new Error(error.message);
    if (data !== null && !isOwnerExperienceMode(data)) throw new Error('Preferência inválida.');
    if (isOwnerExperienceMode(data)) await AsyncStorage.setItem(cacheKey(uid), data).catch(() => undefined);
    return { mode: data, source: 'server' };
  } catch (cause) {
    const cached = await AsyncStorage.getItem(cacheKey(uid)).catch(() => null);
    if (isOwnerExperienceMode(cached)) return { mode: cached, source: 'cache' };
    throw cause;
  }
}

export async function saveOwnerExperience(uid: string, role: string, mode: OwnerExperienceMode): Promise<void> {
  if (role !== 'owner' || !isOwnerExperienceMode(mode)) throw new Error('Acesso exclusivo do proprietário.');
  const { error } = await supabase.rpc('set_owner_mobile_experience', { p_mode: mode });
  if (error) throw new Error(error.message);
  await AsyncStorage.setItem(cacheKey(uid), mode).catch(() => undefined);
}

const routeRoles: Record<string, readonly string[]> = {
  admin: ['owner', 'admin', 'master_admin'],
  supervisor: ['owner', 'supervisor', 'admin', 'master_admin'],
  qe: ['owner', 'supervisor', 'admin', 'master_admin'],
  master: ['owner', 'master_admin'],
  internal: ['owner', 'developer', 'support', 'auditor'],
};
export function canAccessPanelSection(role: string, section: string): boolean {
  return !routeRoles[section] || routeRoles[section].includes(role);
}

export function canAccessPanelRoute(role: string, route: string, canReadReports = false): boolean {
  if (route === 'admin/relatorios' && ['agent', 'supervisor'].includes(role)) return canReadReports;
  return canAccessPanelSection(role, route.split('/')[0]);
}
