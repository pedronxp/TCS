import { supabase } from '../utils/supabase';

export const PUBLIC_PREVIEW_LIMIT = 2;

export interface PublicPreviewAccess {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  reason?: string;
}

async function requestPreviewAccess(
  deviceId: string,
  action: 'status' | 'claim',
): Promise<PublicPreviewAccess> {
  const { data, error } = await supabase.functions.invoke('public-preview-access', {
    body: { action, device_id: deviceId },
  });

  if (error && !data) throw error;
  const source = (data ?? {}) as Partial<PublicPreviewAccess>;
  return {
    allowed: source.allowed === true,
    used: Number(source.used ?? PUBLIC_PREVIEW_LIMIT),
    limit: Number(source.limit ?? PUBLIC_PREVIEW_LIMIT),
    remaining: Math.max(0, Number(source.remaining ?? 0)),
    reason: source.reason,
  };
}

export function getPublicPreviewAccess(deviceId: string): Promise<PublicPreviewAccess> {
  return requestPreviewAccess(deviceId, 'status');
}

export function claimPublicPreviewAttempt(deviceId: string): Promise<PublicPreviewAccess> {
  return requestPreviewAccess(deviceId, 'claim');
}
