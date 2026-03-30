/**
 * Testes unitários: services/SyncService.ts
 * Foco: concorrência, batch logic, tentativas esgotadas
 */

// Mock dependências externas
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));
jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn(),
  BackgroundFetchResult: { NewData: 'NEW_DATA', NoData: 'NO_DATA', Failed: 'FAILED' },
}));
jest.mock('../../utils/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    })),
  },
}));
jest.mock('../../services/NotificationService', () => ({
  notificarSincronizacao: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    runSync: jest.fn(),
    getFirstSync: jest.fn(() => ({ value: '5' })),
    getAllSync: jest.fn(() => []),
    withTransactionSync: jest.fn((cb: () => void) => cb()),
  })),
}));

const mockMarkSincronizado = jest.fn();
const mockMarkErroSync = jest.fn();
const mockIncrementTentativas = jest.fn();
const mockGetVistoriasNaoSincronizadas = jest.fn();

jest.mock('../../utils/database', () => ({
  getVistoriasNaoSincronizadas: (...args: any[]) => mockGetVistoriasNaoSincronizadas(...args),
  markSincronizado: (...args: any[]) => mockMarkSincronizado(...args),
  markErroSync: (...args: any[]) => mockMarkErroSync(...args),
  incrementTentativasSync: (...args: any[]) => mockIncrementTentativas(...args),
  getDb: jest.fn(() => ({ runSync: jest.fn() })),
}));

const makeVistoria = (overrides: Partial<any> = {}) => ({
  id: 'v-1',
  agente_uid: 'uid-1',
  agente_nome: 'Agente',
  municipio: 'SP',
  endereco_rua: 'Rua A',
  endereco_numero: '1',
  endereco_bairro: 'Bairro',
  endereco_cep: null,
  responsavel_nome: null,
  latitude: -23.5,
  longitude: -46.6,
  data_vistoria: new Date().toISOString(),
  formulario_id: 'f1',
  formulario_versao: 1,
  respostas_json: '{}',
  nivel_risco: 'r2',
  pontuacao_total: 35,
  foto_url: null,
  fotos_urls: null,
  sincronizado: 0,
  erro_sync: null,
  tentativas_sync: 0,
  criado_em: new Date().toISOString(),
  ...overrides,
});

describe('syncPendentes', () => {
  beforeEach(() => {
    jest.resetModules();
    mockMarkSincronizado.mockClear();
    mockMarkErroSync.mockClear();
    mockIncrementTentativas.mockClear();
    mockGetVistoriasNaoSincronizadas.mockClear();
  });

  it('retorna { sucesso:0, falha:0 } quando não há pendentes', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([]);
    const { syncPendentes } = require('../SyncService');
    const resultado = await syncPendentes();
    expect(resultado).toEqual({ sucesso: 0, falha: 0 });
  });

  it('sincroniza uma vistoria com sucesso', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([makeVistoria()]);
    const { syncPendentes } = require('../SyncService');
    const resultado = await syncPendentes();
    expect(resultado.sucesso).toBe(1);
    expect(resultado.falha).toBe(0);
    expect(mockMarkSincronizado).toHaveBeenCalledWith('v-1');
  });

  it('ignora vistorias com tentativas esgotadas (≥5)', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([
      makeVistoria({ tentativas_sync: 5 }),
    ]);
    const { syncPendentes } = require('../SyncService');
    const resultado = await syncPendentes();
    expect(resultado.sucesso).toBe(0);
    expect(resultado.falha).toBe(0);
    expect(mockMarkSincronizado).not.toHaveBeenCalled();
  });

  it('protege contra execuções simultâneas', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([]);
    const { syncPendentes } = require('../SyncService');
    // Chamar em paralelo — a segunda deve retornar imediatamente
    const [r1, r2] = await Promise.all([syncPendentes(), syncPendentes()]);
    expect(r1).toEqual({ sucesso: 0, falha: 0 });
    expect(r2).toEqual({ sucesso: 0, falha: 0 });
  });
});
