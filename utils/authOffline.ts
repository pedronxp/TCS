export const OFFLINE_ACCESS_STORAGE_KEY = '@auth_offline_access_v1';
export const OFFLINE_ACCESS_WINDOW_MS = 72 * 60 * 60 * 1000;

export interface OfflineAccessSnapshot {
  uid: string;
  validatedAt: string;
  offlineUntil: string;
}

export function createOfflineAccessSnapshot(
  uid: string,
  nowMs = Date.now(),
  windowMs = OFFLINE_ACCESS_WINDOW_MS
): OfflineAccessSnapshot {
  return {
    uid,
    validatedAt: new Date(nowMs).toISOString(),
    offlineUntil: new Date(nowMs + windowMs).toISOString(),
  };
}

export function parseOfflineAccessSnapshot(raw: string | null): OfflineAccessSnapshot | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OfflineAccessSnapshot> | null;
    if (!parsed?.uid || !parsed.validatedAt || !parsed.offlineUntil) return null;

    const validatedAtMs = Date.parse(parsed.validatedAt);
    const offlineUntilMs = Date.parse(parsed.offlineUntil);

    if (Number.isNaN(validatedAtMs) || Number.isNaN(offlineUntilMs)) return null;
    if (offlineUntilMs < validatedAtMs) return null;

    return {
      uid: parsed.uid,
      validatedAt: new Date(validatedAtMs).toISOString(),
      offlineUntil: new Date(offlineUntilMs).toISOString(),
    };
  } catch {
    return null;
  }
}

export function isOfflineAccessValid(
  snapshot: OfflineAccessSnapshot | null,
  uid: string,
  nowMs = Date.now()
): boolean {
  if (!snapshot || snapshot.uid !== uid) return false;
  return nowMs <= Date.parse(snapshot.offlineUntil);
}

export function isOfflineAccessExpired(
  snapshot: OfflineAccessSnapshot | null,
  uid: string,
  nowMs = Date.now()
): boolean {
  if (!snapshot || snapshot.uid !== uid) return false;
  return nowMs > Date.parse(snapshot.offlineUntil);
}

export function getOfflineAccessRemainingMs(
  snapshot: OfflineAccessSnapshot | null,
  uid: string,
  nowMs = Date.now()
): number {
  if (!snapshot || snapshot.uid !== uid) return 0;
  return Math.max(0, Date.parse(snapshot.offlineUntil) - nowMs);
}
