import { hasAvailableUpdate, shouldForceUpdate } from '../appUpdateRules';

describe('app update rules', () => {
  it('bloqueia somente quando a atualizacao obrigatoria tem apkUrl e build instalado menor que o minimo', () => {
    expect(shouldForceUpdate(9, {
      enabled: true,
      mandatory: true,
      minRequiredVersionCode: 10,
      apkUrl: 'https://example.com/app.apk',
    })).toBe(true);

    expect(shouldForceUpdate(10, {
      enabled: true,
      mandatory: true,
      minRequiredVersionCode: 10,
      apkUrl: 'https://example.com/app.apk',
    })).toBe(false);
  });

  it('nao bloqueia quando configuracao esta desativada, nao obrigatoria ou sem link do APK', () => {
    expect(shouldForceUpdate(9, {
      enabled: false,
      mandatory: true,
      minRequiredVersionCode: 10,
      apkUrl: 'https://example.com/app.apk',
    })).toBe(false);

    expect(shouldForceUpdate(9, {
      enabled: true,
      mandatory: false,
      minRequiredVersionCode: 10,
      apkUrl: 'https://example.com/app.apk',
    })).toBe(false);

    expect(shouldForceUpdate(9, {
      enabled: true,
      mandatory: true,
      minRequiredVersionCode: 10,
      apkUrl: null,
    })).toBe(false);
  });

  it('identifica atualizacao disponivel sem tornar obrigatoria', () => {
    expect(hasAvailableUpdate(9, {
      enabled: true,
      latestVersionCode: 10,
    })).toBe(true);

    expect(hasAvailableUpdate(10, {
      enabled: true,
      latestVersionCode: 10,
    })).toBe(false);
  });
});
