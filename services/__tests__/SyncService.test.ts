/**
 * Testes unitários: services/SyncService.ts
 * Foco: concorrência, batch logic, tentativas esgotadas,
 *       internet real check, file:// guard, appointment sync
 *
 * Estratégia de mock: jest.mock() no topo + referências compartilhadas.
 * NÃO usamos jest.resetModules() para preservar as referências dos mocks
 * entre o módulo SyncService e os testes.
 */

// ─── Mocks globais (declarados antes de qualquer import) ──────────────────────

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

// supabase mock: definido com factory pura (sem fechar sobre variáveis externas,
// pois jest.mock() é hoistado antes das declarações de const/let)
jest.mock('../../utils/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
    })),
  },
}));

// Referências obtidas APÓS o mock estar registrado (via requireMock — não hoistado)
let mockSupabase: any;
let mockUpsertFn: jest.Mock;
let mockDeleteFn: jest.Mock;
let mockEqFn: jest.Mock;
let mockFromFn: jest.Mock;

jest.mock('../../services/NotificationService', () => ({
  notificarSincronizacao: jest.fn().mockResolvedValue(undefined),
  notificarSyncFalha: jest.fn().mockResolvedValue(undefined),
  notificarSyncRetrying: jest.fn().mockResolvedValue(undefined),
  notificarSyncDesistiu: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    runSync: jest.fn(),
    getFirstSync: jest.fn(() => ({ value: '12' })),
    getAllSync: jest.fn(() => []),
    withTransactionSync: jest.fn((cb: () => void) => cb()),
  })),
}));

// Mock checkRealInternet — factory pura com jest.fn() inline
jest.mock('../../context/ConnectivityContext', () => ({
  checkRealInternet: jest.fn().mockResolvedValue(true),
}));

// Mock database — factory pura com jest.fn() inline
// Referências obtidas via jest.requireMock() no beforeEach (após hoisting)
jest.mock('../../utils/database', () => ({
  getVistoriasNaoSincronizadas: jest.fn().mockReturnValue([]),
  markSincronizado: jest.fn(),
  markErroSync: jest.fn(),
  incrementTentativasSync: jest.fn(),
  getDb: jest.fn(() => ({ runSync: jest.fn() })),
  getAgendamentosNaoSincronizados: jest.fn().mockReturnValue([]),
  markAgendamentoSincronizado: jest.fn(),
  deleteAgendamento: jest.fn(),
}));

// Referências obtidas APÓS hoisting (não podem ser declaradas antes de jest.mock)
let mockCheckRealInternet: jest.Mock;
let mockMarkSincronizado: jest.Mock;
let mockMarkErroSync: jest.Mock;
let mockIncrementTentativas: jest.Mock;
let mockGetVistoriasNaoSincronizadas: jest.Mock;
let mockGetAgendamentosNaoSincronizados: jest.Mock;
let mockMarkAgendamentoSincronizado: jest.Mock;
let mockDeleteAgendamento: jest.Mock;

// ─── Import do módulo em teste (uma única vez) ────────────────────────────────

import { syncPendentes, cancelAutoRetry } from '../SyncService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  calculo_json: null,
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

const makeAgendamento = (overrides: Partial<any> = {}) => ({
  id: 'ag-1',
  titulo: 'Vistoria Rua X',
  endereco: 'Rua X, 10',
  municipio: 'SP',
  data_agendada: new Date().toISOString(),
  criado_por_uid: 'uid-supervisor',
  criado_por_nome: 'Supervisor',
  agente_uid: 'uid-1',
  agente_nome: 'Agente',
  lat: -23.5,
  lng: -46.6,
  observacoes: null,
  status: 'pendente',
  criado_em: new Date().toISOString(),
  sincronizado: 0,
  vistoria_id: null,
  ...overrides,
});

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  // Obter referências ao mock do supabase a cada teste
  mockSupabase = jest.requireMock('../../utils/supabase').supabase;
  mockEqFn = jest.fn().mockResolvedValue({ error: null });
  mockDeleteFn = jest.fn(() => ({ eq: mockEqFn }));
  mockUpsertFn = jest.fn().mockResolvedValue({ error: null });
  mockFromFn = jest.fn(() => ({ upsert: mockUpsertFn, delete: mockDeleteFn }));
  mockSupabase.from = mockFromFn;

  // Obter referências aos mocks de database via requireMock (evita TDZ com const)
  const dbMock = jest.requireMock('../../utils/database');
  mockMarkSincronizado = dbMock.markSincronizado as jest.Mock;
  mockMarkErroSync = dbMock.markErroSync as jest.Mock;
  mockIncrementTentativas = dbMock.incrementTentativasSync as jest.Mock;
  mockGetVistoriasNaoSincronizadas = dbMock.getVistoriasNaoSincronizadas as jest.Mock;
  mockGetAgendamentosNaoSincronizados = dbMock.getAgendamentosNaoSincronizados as jest.Mock;
  mockMarkAgendamentoSincronizado = dbMock.markAgendamentoSincronizado as jest.Mock;
  mockDeleteAgendamento = dbMock.deleteAgendamento as jest.Mock;

  // Obter referência ao mock de checkRealInternet
  mockCheckRealInternet = jest.requireMock('../../context/ConnectivityContext').checkRealInternet as jest.Mock;
  const storageMock = jest.requireMock('../../services/StorageService');
  storageMock.uploadImageFromLocalUri.mockReset();
  storageMock.uploadImageFromLocalUri.mockResolvedValue('https://storage.example.com/foto.jpg');

  // Limpar contadores de chamadas dos mocks de database
  mockMarkSincronizado.mockClear();
  mockMarkErroSync.mockClear();
  mockIncrementTentativas.mockClear();
  mockGetVistoriasNaoSincronizadas.mockClear();
  mockGetVistoriasNaoSincronizadas.mockReturnValue([]);
  mockGetAgendamentosNaoSincronizados.mockClear();
  mockGetAgendamentosNaoSincronizados.mockReturnValue([]);
  mockMarkAgendamentoSincronizado.mockClear();
  mockDeleteAgendamento.mockClear();
  mockCheckRealInternet.mockClear();
  mockCheckRealInternet.mockResolvedValue(true);
});

afterEach(() => {
  // Cancelar qualquer retry timer pendente para evitar open handles
  cancelAutoRetry();
  jest.clearAllTimers();
});

// ─── Suite principal ──────────────────────────────────────────────────────────

describe('syncPendentes', () => {

  // ── Critério 1: sem internet real, NÃO consome fila ────────────────────────

  it('retorna { sucesso:0, falha:0 } sem tocar na fila quando não há internet real', async () => {
    mockCheckRealInternet.mockResolvedValue(false);
    mockGetVistoriasNaoSincronizadas.mockReturnValue([makeVistoria()]);

    const resultado = await syncPendentes();

    expect(resultado).toEqual({ sucesso: 0, falha: 0 });
    // Fila NÃO deve ter sido consultada
    expect(mockGetVistoriasNaoSincronizadas).not.toHaveBeenCalled();
    // Tentativas NÃO devem ter sido incrementadas
    expect(mockIncrementTentativas).not.toHaveBeenCalled();
  });

  it('NÃO agenda retry quando early-exit por falta de internet real', async () => {
    jest.useFakeTimers();
    try {
      mockCheckRealInternet.mockResolvedValue(false);
      mockGetVistoriasNaoSincronizadas.mockReturnValue([makeVistoria()]);

      await syncPendentes();

      // Avançar 35s — nenhum retry deve ter sido agendado
      await jest.advanceTimersByTimeAsync(35_000);
      expect(mockGetVistoriasNaoSincronizadas).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  // ── Critério 2: nunca envia file:// ao Supabase ────────────────────────────

  it('payload upsert nunca contém file:// quando upload falhou', async () => {
    const { uploadImageFromLocalUri } = require('../../services/StorageService');
    uploadImageFromLocalUri.mockRejectedValueOnce(new Error('network error'));

    // Foto local que NÃO foi uploadada (upload falhou)
    mockGetVistoriasNaoSincronizadas.mockReturnValue([
      makeVistoria({ foto_url: 'file:///local/foto.jpg' }),
    ]);

    const resultado = await syncPendentes();

    // Se upsert foi chamado (em algum fallback), não deve conter file://
    expect(resultado).toEqual({ sucesso: 0, falha: 1 });
    expect(mockUpsertFn).toHaveBeenCalledTimes(1);
    expect(mockMarkSincronizado).not.toHaveBeenCalledWith('v-1');
    expect(mockMarkErroSync).toHaveBeenCalledWith('v-1', 'Dados enviados; mídia local pendente de upload.');

    for (const call of mockUpsertFn.mock.calls) {
      const payload = Array.isArray(call[0]) ? call[0][0] : call[0];
      expect(payload.fotoUrl).toBeNull();
    }
  });

  it('remove fotosUrls file:// do payload quando upload de evidencia falha', async () => {
    const { uploadImageFromLocalUri } = require('../../services/StorageService');
    uploadImageFromLocalUri.mockRejectedValueOnce(new Error('network error'));

    mockGetVistoriasNaoSincronizadas.mockReturnValue([
      makeVistoria({
        fotos_urls: JSON.stringify([
          'file:///local/evidencia.jpg',
          'https://cdn.example.com/evidencia-ok.jpg',
        ]),
      }),
    ]);

    const resultado = await syncPendentes();

    expect(resultado).toEqual({ sucesso: 0, falha: 1 });
    expect(mockUpsertFn).toHaveBeenCalledTimes(1);
    const payload = mockUpsertFn.mock.calls[0][0];
    const fotosUrls = Array.isArray(payload) ? payload[0].fotosUrls : payload.fotosUrls;
    expect(fotosUrls).toEqual(['https://cdn.example.com/evidencia-ok.jpg']);
    expect(mockMarkSincronizado).not.toHaveBeenCalledWith('v-1');
    expect(mockMarkErroSync).toHaveBeenCalledWith('v-1', 'Dados enviados; mídia local pendente de upload.');
  });

  it('buildSupabasePayload passa fotoUrl https:// corretamente', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([
      makeVistoria({ foto_url: 'https://cdn.example.com/foto.jpg' }),
    ]);

    await syncPendentes();

    expect(mockUpsertFn).toHaveBeenCalledTimes(1);
    const payload = mockUpsertFn.mock.calls[0][0];
    const fotoUrl = Array.isArray(payload) ? payload[0].fotoUrl : payload.fotoUrl;
    expect(fotoUrl).toBe('https://cdn.example.com/foto.jpg');
  });

  // ── Critério 5: status contract ────────────────────────────────────────────

  it('buildSupabasePayload usa status concluida (não sincronizado)', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([makeVistoria()]);

    await syncPendentes();

    expect(mockUpsertFn).toHaveBeenCalledTimes(1);
    const payload = mockUpsertFn.mock.calls[0][0];
    const status = Array.isArray(payload) ? payload[0].status : payload.status;
    expect(status).toBe('concluida');
  });

  // ── Critério 4: appointment sync ───────────────────────────────────────────

  it('sincroniza agendamento pendente (status != deletado)', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([]);
    mockGetAgendamentosNaoSincronizados.mockReturnValue([makeAgendamento()]);

    await syncPendentes();

    expect(mockMarkAgendamentoSincronizado).toHaveBeenCalledWith('ag-1');
  });

  it('deleta agendamento com tombstone (status=deletado)', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([]);
    mockGetAgendamentosNaoSincronizados.mockReturnValue([
      makeAgendamento({ status: 'deletado', sincronizado: 0 }),
    ]);

    await syncPendentes();

    // Deve ter chamado delete().eq() no Supabase
    expect(mockDeleteFn).toHaveBeenCalled();
    // Deve ter removido o registro local
    expect(mockDeleteAgendamento).toHaveBeenCalledWith('ag-1');
  });

  // ── Testes existentes ─────────────────────────────────────────────────────

  it('retorna { sucesso:0, falha:0 } quando não há pendentes', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([]);
    const resultado = await syncPendentes();
    expect(resultado).toEqual({ sucesso: 0, falha: 0 });
  });

  it('sincroniza uma vistoria com sucesso', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([makeVistoria()]);
    const resultado = await syncPendentes();
    expect(resultado.sucesso).toBe(1);
    expect(resultado.falha).toBe(0);
    expect(mockMarkSincronizado).toHaveBeenCalledWith('v-1');
  });

  it('ignora vistorias com tentativas esgotadas (≥5)', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([
      makeVistoria({ tentativas_sync: 5 }),
    ]);
    const resultado = await syncPendentes();
    expect(resultado.sucesso).toBe(0);
    expect(resultado.falha).toBe(0);
    expect(mockMarkSincronizado).not.toHaveBeenCalled();
  });

  it('protege contra execuções simultâneas', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([]);
    const [r1, r2] = await Promise.all([syncPendentes(), syncPendentes()]);
    expect(r1).toEqual({ sucesso: 0, falha: 0 });
    expect(r2).toEqual({ sucesso: 0, falha: 0 });
  });

  it('deduplicação: mesmo id nunca gera upsert duplo', async () => {
    mockGetVistoriasNaoSincronizadas
      .mockReturnValueOnce([makeVistoria()])
      .mockReturnValueOnce([]);

    await syncPendentes();
    await syncPendentes();

    expect(mockUpsertFn).toHaveBeenCalledTimes(1);
  });

  it('foto file:// dispara upload via StorageService antes do upsert', async () => {
    const { uploadImageFromLocalUri } = require('../../services/StorageService');
    uploadImageFromLocalUri.mockResolvedValue('https://storage.example.com/foto.jpg');

    const vistoriaComFoto = makeVistoria({ foto_url: 'file:///cache/foto.jpg' });
    mockGetVistoriasNaoSincronizadas.mockReturnValue([vistoriaComFoto]);

    const resultado = await syncPendentes();

    expect(uploadImageFromLocalUri).toHaveBeenCalledWith(
      'file:///cache/foto.jpg',
      expect.any(String)
    );

    expect(mockUpsertFn).toHaveBeenCalledTimes(1);
    const payload = mockUpsertFn.mock.calls[0][0];
    const fotoUrlNoPayload = Array.isArray(payload) ? payload[0].fotoUrl : payload.fotoUrl;
    expect(fotoUrlNoPayload).toMatch(/^https:\/\//);
    expect(fotoUrlNoPayload).not.toMatch(/^file:\/\//);

    expect(resultado.sucesso).toBe(1);
  });

  it('falha de upsert incrementa tentativas e marca erro', async () => {
    mockUpsertFn.mockResolvedValue({ error: { message: 'network error' } });
    mockGetVistoriasNaoSincronizadas.mockReturnValue([makeVistoria()]);

    const resultado = await syncPendentes();

    // Cancelar retry imediatamente para não deixar timer aberto
    cancelAutoRetry();

    expect(resultado.sucesso).toBe(0);
    expect(resultado.falha).toBe(1);
    expect(mockIncrementTentativas).toHaveBeenCalledWith('v-1');
    expect(mockMarkErroSync).toHaveBeenCalledWith('v-1', 'network error');
  });

  it('preserva vistoria offline bloqueada por limite sem gastar tentativas nem agendar retry', async () => {
    jest.useFakeTimers();
    try {
      const limitError = { message: 'inspection_creation_blocked', details: '{"reason":"limit_reached"}' };
      mockUpsertFn.mockResolvedValue({ error: limitError });
      mockGetVistoriasNaoSincronizadas.mockReturnValue([makeVistoria()]);

      const resultado = await syncPendentes();

      expect(resultado).toEqual({ sucesso: 0, falha: 1 });
      expect(mockIncrementTentativas).not.toHaveBeenCalled();
      expect(mockMarkSincronizado).not.toHaveBeenCalled();
      expect(mockMarkErroSync).toHaveBeenCalledWith('v-1', expect.stringContaining('permanece salva'));

      const chamadas = mockUpsertFn.mock.calls.length;
      await jest.advanceTimersByTimeAsync(31_000);
      expect(mockUpsertFn).toHaveBeenCalledTimes(chamadas);
    } finally {
      jest.useRealTimers();
    }
  });

  it('backoff: retry agendado em 30s após falha', async () => {
    jest.useFakeTimers();
    try {
      mockUpsertFn
        .mockResolvedValueOnce({ error: { message: 'network error' } }) // batch falha
        .mockResolvedValueOnce({ error: { message: 'network error' } }) // individual fallback
        .mockResolvedValue({ error: null }); // retry ok

      mockGetVistoriasNaoSincronizadas
        .mockReturnValueOnce([makeVistoria()])
        .mockReturnValue([]);

      const resultado = await syncPendentes();
      expect(resultado.falha).toBe(1);

      const chamatasAntes = mockGetVistoriasNaoSincronizadas.mock.calls.length;

      // 29.999ms: nenhum timer disparou ainda
      await jest.advanceTimersByTimeAsync(29_999);
      expect(mockGetVistoriasNaoSincronizadas.mock.calls.length).toBe(chamatasAntes);

      // +1ms = 30.000ms total: timer dispara
      await jest.advanceTimersByTimeAsync(1);
      await jest.runAllTimersAsync();
      expect(mockGetVistoriasNaoSincronizadas.mock.calls.length).toBeGreaterThan(chamatasAntes);

      cancelAutoRetry();
    } finally {
      jest.useRealTimers();
    }
  });

  it('vistoria esgotada (5 tentativas) é ignorada sem incrementar', async () => {
    mockGetVistoriasNaoSincronizadas.mockReturnValue([
      makeVistoria({ tentativas_sync: 5 }),
    ]);
    const resultado = await syncPendentes();

    expect(resultado).toEqual({ sucesso: 0, falha: 0 });
    expect(mockIncrementTentativas).not.toHaveBeenCalled();
    expect(mockMarkErroSync).not.toHaveBeenCalled();
  });
});
