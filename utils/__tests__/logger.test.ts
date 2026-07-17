/**
 * Testes unitários: utils/logger.ts
 * Foco: sanitização de dados sensíveis e API pública
 */

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    runSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    getAllSync: jest.fn(() => []),
    withTransactionSync: jest.fn((cb: () => void) => cb()),
  })),
}));

// Silenciar output do console durante os testes
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('logger.sanitize — via comportamento observável', () => {
  let mockRunSync: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    mockRunSync = jest.fn();
    const mockDb = {
      runSync: mockRunSync,
      getFirstSync: jest.fn(() => ({ value: '5' })),
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);
  });

  it('não salva senhas no log', () => {
    const { logger } = require('../logger');
    logger.error('auth', 'Login falhou', { password: 'senha123', email: 'user@example.com' });

    const callArgs = mockRunSync.mock.calls.find(
      (call: any[]) => call[0]?.includes('INSERT INTO logs')
    );
    expect(callArgs).toBeDefined();
    const dataJson = callArgs![1][3] as string;
    expect(dataJson).not.toContain('senha123');
    expect(dataJson).toContain('[REDACTED]');
  });

  it('não salva tokens no log', () => {
    const { logger } = require('../logger');
    logger.info('token', 'Token gerado', { token: 'ABCD-EFGH-IJKL' });

    const callArgs = mockRunSync.mock.calls.find(
      (call: any[]) => call[0]?.includes('INSERT INTO logs')
    );
    const dataJson = callArgs?.[1][3] as string;
    expect(dataJson).not.toContain('ABCD-EFGH-IJKL');
    expect(dataJson).toContain('[REDACTED]');
  });

  it('preserva dados não-sensíveis', () => {
    const { logger } = require('../logger');
    logger.info('sync', 'Sync concluído', { sucesso: 5, falha: 0, municipio: 'Campinas' });

    const callArgs = mockRunSync.mock.calls.find(
      (call: any[]) => call[0]?.includes('INSERT INTO logs')
    );
    const dataJson = callArgs?.[1][3] as string;
    expect(dataJson).toContain('Campinas');
    expect(dataJson).toContain('"sucesso":5');
  });

  it('não lança exceção se banco falhar', () => {
    mockRunSync.mockImplementation(() => { throw new Error('SQLite error'); });
    const { logger } = require('../logger');
    expect(() => logger.info('system', 'Teste', { key: 'value' })).not.toThrow();
  });
});

describe('logger API', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('expõe info, warn e error', () => {
    const { logger } = require('../logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('não envia falha de sincronização ao console.error/LogBox', () => {
    const { logger } = require('../logger');
    logger.error('sync', 'Falha individual (tentativa 1/5)', { id: 'v-1' });

    expect(console.error).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      '[ERROR][sync]',
      'Falha individual (tentativa 1/5)',
      { id: 'v-1' },
    );
  });
});
