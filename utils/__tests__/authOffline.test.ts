import {
  OFFLINE_ACCESS_WINDOW_MS,
  createOfflineAccessSnapshot,
  getOfflineAccessRemainingMs,
  isOfflineAccessExpired,
  isOfflineAccessValid,
  parseOfflineAccessSnapshot,
} from '../authOffline';

describe('authOffline', () => {
  const NOW_MS = Date.parse('2026-04-14T12:00:00.000Z');
  const UID = 'user-123';

  it('cria snapshot com janela de 72 horas', () => {
    const snapshot = createOfflineAccessSnapshot(UID, NOW_MS);

    expect(snapshot.uid).toBe(UID);
    expect(snapshot.validatedAt).toBe('2026-04-14T12:00:00.000Z');
    expect(Date.parse(snapshot.offlineUntil) - Date.parse(snapshot.validatedAt)).toBe(OFFLINE_ACCESS_WINDOW_MS);
  });

  it('considera snapshot valido ate o limite exato', () => {
    const snapshot = createOfflineAccessSnapshot(UID, NOW_MS);
    const expiresAt = Date.parse(snapshot.offlineUntil);

    expect(isOfflineAccessValid(snapshot, UID, expiresAt - 1)).toBe(true);
    expect(isOfflineAccessValid(snapshot, UID, expiresAt)).toBe(true);
    expect(isOfflineAccessExpired(snapshot, UID, expiresAt)).toBe(false);
  });

  it('considera snapshot expirado apos o prazo', () => {
    const snapshot = createOfflineAccessSnapshot(UID, NOW_MS);
    const afterExpiry = Date.parse(snapshot.offlineUntil) + 1;

    expect(isOfflineAccessValid(snapshot, UID, afterExpiry)).toBe(false);
    expect(isOfflineAccessExpired(snapshot, UID, afterExpiry)).toBe(true);
    expect(getOfflineAccessRemainingMs(snapshot, UID, afterExpiry)).toBe(0);
  });

  it('invalida snapshot de outro usuario', () => {
    const snapshot = createOfflineAccessSnapshot(UID, NOW_MS);

    expect(isOfflineAccessValid(snapshot, 'other-user', NOW_MS)).toBe(false);
    expect(isOfflineAccessExpired(snapshot, 'other-user', NOW_MS)).toBe(false);
  });

  it('faz parse apenas de payload valido', () => {
    const snapshot = createOfflineAccessSnapshot(UID, NOW_MS);

    expect(parseOfflineAccessSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(parseOfflineAccessSnapshot(null)).toBeNull();
    expect(parseOfflineAccessSnapshot('not-json')).toBeNull();
    expect(parseOfflineAccessSnapshot(JSON.stringify({ uid: UID }))).toBeNull();
    expect(
      parseOfflineAccessSnapshot(
        JSON.stringify({
          uid: UID,
          validatedAt: '2026-04-17T12:00:00.000Z',
          offlineUntil: '2026-04-14T12:00:00.000Z',
        })
      )
    ).toBeNull();
  });
});
