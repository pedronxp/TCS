import { activeSessionExpired, resolveNewSessionDecision, sessionRegistrationState, shouldTerminateAfterHeartbeat } from '../sessionControl';

describe('session control', () => {
  it('terminates only when a successful heartbeat says the session is inactive', () => {
    expect(shouldTerminateAfterHeartbeat(false, false)).toBe(true);
    expect(shouldTerminateAfterHeartbeat(false, true)).toBe(false);
    expect(shouldTerminateAfterHeartbeat(true, false)).toBe(false);
  });

  it('classifies atomic registration responses', () => {
    expect(sessionRegistrationState({ allowed: true })).toBe('allowed');
    expect(sessionRegistrationState({ allowed: false })).toBe('conflict');
    expect(sessionRegistrationState(null)).toBe('unavailable');
  });

  it('blocks simultaneous login for the same person but not different users', () => {
    expect(resolveNewSessionDecision({ enforcementEnabled: true, hasActiveSession: true, sameAuthSession: false, policy: 'block', replaceRequested: false })).toBe('block');
    expect(resolveNewSessionDecision({ enforcementEnabled: true, hasActiveSession: false, sameAuthSession: false, policy: 'block', replaceRequested: false })).toBe('allow');
  });

  it('allows explicit device replacement and treats reinstall as a new device', () => {
    expect(resolveNewSessionDecision({ enforcementEnabled: true, hasActiveSession: true, sameAuthSession: false, policy: 'block', replaceRequested: true })).toBe('replace');
    expect(resolveNewSessionDecision({ enforcementEnabled: true, hasActiveSession: true, sameAuthSession: false, policy: 'replace', replaceRequested: false })).toBe('replace');
  });

  it('honors offline tolerance before expiring an abandoned device', () => {
    const now = Date.parse('2026-07-16T12:00:00Z');
    expect(activeSessionExpired(now - 30 * 60_000, now, 15, 30)).toBe(false);
    expect(activeSessionExpired(now - 46 * 60_000, now, 15, 30)).toBe(true);
  });
});
