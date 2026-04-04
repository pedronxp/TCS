/**
 * Testes unitários: services/SyncService.ts
 * Foco: concorrência, batch logic, tentativas esgotadas
 */

// Mock dependências externas
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/StorageService', () => ({
  uploadImageFromLocalUri: jest.fn().mockResolvedValue('https://storage.example.com/foto.jpg'),
}));
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

  it('deduplicação: mesmo id nunca gera upsert duplo', async () => {
    const { supabase } = require('../../utils/supabase');
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ upsert: mockUpsert });

    // Primeira chamada: retorna a vistoria pendente
    mockGetVistoriasNaoSincronizadas.mockReturnValueOnce([makeVistoria()]);
    // Segunda chamada: fila vazia (primeiro sync já marcou como sincronizado)
    mockGetVistoriasNaoSincronizadas.mockReturnValueOnce([]);

    const { syncPendentes } = require('../SyncService');
    await syncPendentes();
    await syncPendentes();

    // upsert deve ter sido chamado exatamente 1 vez (só no primeiro sync)
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('foto file:// dispara upload via StorageService antes do upsert', async () => {
    const { uploadImageFromLocalUri } = require('../../services/StorageService');
    const { supabase } = require('../../utils/supabase');
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ upsert: mockUpsert });

    const vistoriaComFoto = makeVistoria({ foto_url: 'file:///cache/foto.jpg' });
    mockGetVistoriasNaoSincronizadas.mockReturnValue([vistoriaComFoto]);

    const { syncPendentes } = require('../SyncService');
    const resultado = await syncPendentes();

    // uploadImageFromLocalUri deve ter sido chamado com a URI local
    expect(uploadImageFromLocalUri).toHaveBeenCalledWith(
      'file:///cache/foto.jpg',
      expect.any(String)
    );

    // O payload enviado ao upsert deve conter a URL pública (https://), não file://
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const payload = mockUpsert.mock.calls[0][0];
    const fotoUrlNoPayload = Array.isArray(payload) ? payload[0].fotoUrl : payload.fotoUrl;
    expect(fotoUrlNoPayload).toMatch(/^https:\/\//);
    expect(fotoUrlNoPayload).not.toMatch(/^file:\/\//);

    expect(resultado.sucesso).toBe(1);
  });

  it('falha de upsert incrementa tentativas e marca erro', async () => {
    const { supabase } = require('../../utils/supabase');
    const mockUpsert = jest
      .fn()
      .mockResolvedValue({ error: { message: 'network error' } });
    supabase.from.mockReturnValue({ upsert: mockUpsert });

    mockGetVistoriasNaoSincronizadas.mockReturnValue([makeVistoria()]);

    const { syncPendentes } = require('../SyncService');
    const resultado = await syncPendentes();

    expect(resultado.sucesso).toBe(0);
    expect(resultado.falha).toBe(1);
    expect(mockIncrementTentativas).toHaveBeenCalledWith('v-1');
    expect(mockMarkErroSync).toHaveBeenCalledWith('v-1', 'network error');
  });

  it('backoff: retry agendado em 30s após falha', async () => {
    jest.useFakeTimers();
    try {
      const { supabase } = require('../../utils/supabase');
      // Batch upsert falha (1ª vez) → individual fallback também falha (2ª vez)
      // → sucesso=0, falha=1 → scheduleAutoRetry agenda timer de 30s
      // Após 30s retry dispara → getVistoriasNaoSincronizadas é chamado novamente
      const mockUpsert = jest
        .fn()
        .mockResolvedValueOnce({ error: { message: 'network error' } }) // batch falha
        .mockResolvedValueOnce({ error: { message: 'network error' } }) // individual fallback falha
        .mockResolvedValue({ error: null }); // chamadas subsequentes ok
      supabase.from.mockReturnValue({ upsert: mockUpsert });

      mockGetVistoriasNaoSincronizadas.mockReturnValueOnce([makeVistoria()]);
      mockGetVistoriasNaoSincronizadas.mockReturnValue([]);

      const { syncPendentes } = require('../SyncService');
      const resultado = await syncPendentes();
      // Confirma que houve falha (scheduleAutoRetry foi disparado)
      expect(resultado.falha).toBe(1);

      const chamatasAntes = mockGetVistoriasNaoSincronizadas.mock.calls.length;

      // 29.999ms: nenhum timer disparou ainda — retry NÃO executado
      await jest.advanceTimersByTimeAsync(29_999);
      expect(mockGetVistoriasNaoSincronizadas.mock.calls.length).toBe(chamatasAntes);

      // +1ms = 30.000ms total: timer dispara, syncPendentes(true) é chamado
      await jest.advanceTimersByTimeAsync(1);
      await jest.runAllTimersAsync();
      expect(mockGetVistoriasNaoSincronizadas.mock.calls.length).toBeGreaterThan(chamatasAntes);
    } finally {
      jest.useRealTimers();
    }
  });

  it('vistoria esgotada (5 tentativas) é ignorada sem incrementar', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([
      makeVistoria({ tentativas_sync: 5 }),
    ]);
    const { syncPendentes } = require('../SyncService');
    const resultado = await syncPendentes();

    expect(resultado).toEqual({ sucesso: 0, falha: 0 });
    expect(mockIncrementTentativas).not.toHaveBeenCalled();
    expect(mockMarkErroSync).not.toHaveBeenCalled();
  });
});
