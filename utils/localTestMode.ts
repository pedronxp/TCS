import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AuthUserLike = Pick<User, 'app_metadata'> | null | undefined;

export function isLocalTestUser(user: AuthUserLike): boolean {
  return user?.app_metadata?.local_test_mode === true;
}

export function isLocalTestSession(session: Pick<Session, 'user'> | null | undefined): boolean {
  return isLocalTestUser(session?.user);
}

export function isDeveloperUser(user: AuthUserLike): boolean {
  return user?.app_metadata?.developer_access === true
    && user?.app_metadata?.account_type === 'developer_demo';
}

export function isDeveloperSession(session: Pick<Session, 'user'> | null | undefined): boolean {
  return isDeveloperUser(session?.user);
}

export async function isCurrentSessionLocalTest(): Promise<boolean> {
  try {
    const auth = (supabase as any).auth;
    if (!auth?.getSession) return false;
    const { data } = await auth.getSession();
    return isLocalTestSession(data?.session);
  } catch {
    return false;
  }
}
