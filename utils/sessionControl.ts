export function shouldTerminateAfterHeartbeat(data: unknown, hasError: boolean): boolean {
  return !hasError && data === false;
}

export function sessionRegistrationState(data: unknown): 'allowed' | 'conflict' | 'unavailable' {
  if (!data || typeof data !== 'object') return 'unavailable';
  return (data as { allowed?: boolean }).allowed === false ? 'conflict' : 'allowed';
}

export function activeSessionExpired(lastHeartbeatMs: number, nowMs: number, timeoutMinutes: number, offlineToleranceMinutes: number): boolean {
  const allowedSilence = Math.max(0, timeoutMinutes + offlineToleranceMinutes) * 60_000;
  return nowMs - lastHeartbeatMs > allowedSilence;
}

export function resolveNewSessionDecision(input: { enforcementEnabled: boolean; hasActiveSession: boolean; sameAuthSession: boolean; policy: 'block' | 'replace'; replaceRequested: boolean }): 'allow' | 'block' | 'replace' {
  if (!input.hasActiveSession || input.sameAuthSession) return 'allow';
  if (!input.enforcementEnabled || input.replaceRequested || input.policy === 'replace') return 'replace';
  return 'block';
}
