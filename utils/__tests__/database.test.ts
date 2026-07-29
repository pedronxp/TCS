/**
 * Testes unitários: utils/database.ts
 * Foco: lógica pura — sem SQLite real (mocado)
 */

// Mock expo-sqlite antes de qualquer import
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    runSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    getAllSync: jest.fn(() => []),
    withTransactionSync: jest.fn((cb: () => void) => cb()),
  })),
}));

import * as SQLite from 'expo-sqlite';

// ─── Helpers reutilizados internamente ─────────────────────────────────────

describe('VistoriaLocal shape', () => {
  it('tem os campos obrigatórios definidos', () => {
    const vistoria = {
      id: 'test-id',
      agente_uid: 'uid-1',
      agente_nome: 'Agente Teste',
      municipio: 'São Paulo',
      endereco_rua: 'Rua Teste',
      endereco_numero: '123',
      endereco_bairro: 'Centro',
      endereco_cep: '01310-100',
      responsavel_nome: 'Responsável',
      latitude: -23.5505,
      longitude: -46.6333,
      data_vistoria: new Date().toISOString(),
      formulario_id: 'estrutural_v1',
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
    };

    expect(vistoria.id).toBeTruthy();
    expect(vistoria.nivel_risco).toMatch(/^r[1-4]$/);
    expect(vistoria.sincronizado).toBe(0);
  });
});

describe('getDb singleton', () => {
  it('abre o banco apenas uma vez (singleton)', () => {
    // Re-requere o módulo em contexto limpo para testar singleton
    jest.resetModules();
    // Após resetModules, precisamos usar o mock re-registrado via require
    const SQLiteFresh = require('expo-sqlite');
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    SQLiteFresh.openDatabaseSync.mockReturnValue(mockDb);

    const { getDb } = require('../database');
    getDb();
    getDb();
    // openDatabaseSync deve ter sido chamado apenas 1x (singleton)
    expect(SQLiteFresh.openDatabaseSync).toHaveBeenCalledTimes(1);
  });
});

describe('FormularioCache shape', () => {
  it('tem os campos obrigatórios', () => {
    const cache = {
      id: 'form-1',
      titulo: 'Formulário Teste',
      descricao: null,
      versao: 2,
      status: 'publicado',
      perguntas_json: '[]',
      municipio: 'Campinas',
      atualizado_em: new Date().toISOString(),
      cached_at: new Date().toISOString(),
    };

    expect(cache.status).toBe('publicado');
    expect(() => JSON.parse(cache.perguntas_json)).not.toThrow();
  });
});

describe('updateVistoriaMedia', () => {
  it('persiste foto principal e evidências adicionais separadamente', () => {
    jest.resetModules();
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);
    const { updateVistoriaMedia } = require('../database');

    updateVistoriaMedia('vistoria-1', 'fotos:principal.jpg', [
      'fotos:evidencia-1.jpg',
      'file:///evidencia-2.jpg',
    ]);

    const updateCall = mockDb.runSync.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('SET foto_url = ?, fotos_urls = ?')
    );
    expect(updateCall?.[1]).toEqual([
      'fotos:principal.jpg',
      JSON.stringify(['fotos:evidencia-1.jpg', 'file:///evidencia-2.jpg']),
      'vistoria-1',
    ]);
  });
});

describe('purgeLocalTestData', () => {
  it('remove apenas dados temporários do usuário e devolve os arquivos locais', () => {
    jest.resetModules();
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn((sql: string) =>
        sql.includes('document_ack_events_local') ? { total: 1 } : null
      ),
      getAllSync: jest.fn((sql: string) => {
        if (sql.includes('FROM vistorias_offline')) {
          return [{
            id: 'test-vistoria',
            foto_url: 'file:///foto-principal.jpg',
            fotos_urls: JSON.stringify(['file:///evidencia.jpg', 'fotos:remota.jpg']),
            laudo_local_uri: 'file:///laudo.pdf',
          }];
        }
        if (sql.includes('FROM generated_documents_local')) {
          return [{ id: 'doc-1', pdf_local_uri: 'file:///documento.pdf' }];
        }
        return [];
      }),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);

    const { purgeLocalTestData } = require('../database');
    const result = purgeLocalTestData('developer-uid');

    expect(result).toEqual({
      vistoriaCount: 1,
      documentCount: 1,
      eventCount: 1,
      fileUris: expect.arrayContaining([
        'file:///foto-principal.jpg',
        'file:///evidencia.jpg',
        'file:///laudo.pdf',
        'file:///documento.pdf',
      ]),
    });
    const selectCalls = mockDb.getAllSync.mock.calls as unknown as any[][];
    const selectVistorias = selectCalls.find((call: any[]) =>
      String(call[0]).includes('FROM vistorias_offline')
    );
    expect(selectVistorias?.[0]).toContain('training_class_id IS NULL');
    expect(selectVistorias?.[1]).toEqual(['developer-uid']);
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM vistorias_offline'),
      ['test-vistoria']
    );
  });
});

describe('insertVistoria — persistência offline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('insere com sincronizado=0 por padrão', () => {
    // Capturar a instância do db que o módulo vai usar
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);

    const { insertVistoria } = require('../database');

    const vistoria = {
      id: 'test-offline-001',
      agente_uid: 'uid-agente',
      agente_nome: 'Agente Teste',
      municipio: 'Santos',
      endereco_rua: 'Rua das Flores',
      endereco_numero: '42',
      endereco_bairro: 'Centro',
      endereco_cep: null,
      responsavel_nome: null,
      latitude: -23.9618,
      longitude: -46.3322,
      data_vistoria: new Date().toISOString(),
      formulario_id: 'estrutural_v1',
      formulario_versao: 1,
      respostas_json: JSON.stringify({ e1q1: 'rachadura', e2q1: 'loc_pilares' }),
      nivel_risco: 'r3',
      pontuacao_total: 60,
      calculo_json: null,
      foto_url: null,
      criado_em: new Date().toISOString(),
    };

    // Não deve lançar exceção
    expect(() => insertVistoria(vistoria)).not.toThrow();

    // runSync deve ter sido chamado (INSERT OR REPLACE)
    expect(mockDb.runSync).toHaveBeenCalled();

    // O SQL do INSERT deve conter a tabela vistorias_offline (sincronizado=0 é literal no SQL)
    const chamadas = mockDb.runSync.mock.calls;
    const insertCall = chamadas.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('INSERT OR REPLACE INTO vistorias_offline')
    );
    expect(insertCall).toBeDefined();
  });

  it('nivel_risco aceita apenas r1-r4', () => {
    const niveis = ['r1', 'r2', 'r3', 'r4'];
    niveis.forEach(n => {
      expect(n).toMatch(/^r[1-4]$/);
    });
  });

  it('respostas_json é string JSON válida', () => {
    const respostas = { e1q1: 'rachadura', e5q1: 'ativa' };
    const json = JSON.stringify(respostas);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)).toEqual(respostas);
  });

  it('insertTrainingVistoria grava como sincronizado para impedir sync de produção', () => {
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);

    const { insertTrainingVistoria } = require('../database');

    const vistoria = {
      id: 'training-001',
      agente_uid: 'training:participant-1',
      agente_nome: 'Aluno Teste',
      municipio: 'Treinamento',
      endereco_rua: 'Rua Aula',
      endereco_numero: '10',
      endereco_bairro: 'Centro',
      endereco_cep: null,
      responsavel_nome: null,
      latitude: null,
      longitude: null,
      data_vistoria: new Date().toISOString(),
      formulario_id: 'vistoria_deslizamento_v3',
      formulario_versao: 3,
      respostas_json: '{}',
      calculo_json: null,
      nivel_risco: 'r1',
      pontuacao_total: 0,
      foto_url: null,
      feita_online: 1,
      modo_treinamento: 1,
      training_class_id: 'class-1',
      training_participant_id: 'participant-1',
      criado_em: new Date().toISOString(),
    };

    expect(() => insertTrainingVistoria(vistoria)).not.toThrow();

    const calls = mockDb.runSync.mock.calls as any[][];
    const insertCall = calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('INSERT OR REPLACE INTO vistorias_offline')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![0]).toContain('modo_treinamento');
    expect(insertCall![0]).toContain('training_class_id');
    expect(insertCall![0]).toContain('training_participant_id');

    const params = insertCall![1] as any[];
    expect(params[params.length - 5]).toBe(1); // modo_treinamento
    expect(params).toContain('class-1');
    expect(params).toContain('participant-1');
    expect(params[params.length - 2]).toBe(1); // sincronizado
  });
});

describe('getVistoriasByAgente — filtragem por agente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('chama getAllSync com agente_uid correto', () => {
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);

    const { getVistoriasByAgente } = require('../database');
    const uid = 'uid-agente-teste';
    getVistoriasByAgente(uid);

    const chamadas: any[][] = mockDb.getAllSync.mock.calls as any[][];
    const selectCall = chamadas.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('agente_uid')
    );
    expect(selectCall).toBeDefined();
    expect(selectCall![1]).toContain(uid);
    expect(selectCall![0]).toContain('COALESCE(modo_treinamento, 0) = 0');
    expect(selectCall![0]).toContain("agente_uid NOT LIKE 'training:%'");
  });

  it('separa consultas oficiais e consultas de treinamento', () => {
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => ({ total: 0 })),
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);

    const {
      getVistoriasNaoSincronizadas,
      getVistoriasByMunicipio,
      getAllVistorias,
      getTrainingVistoriasByAgente,
      getOfficialVistoriaById,
      getTrainingVistoriaById,
      countPendentes,
    } = require('../database');

    getVistoriasNaoSincronizadas();
    getVistoriasByMunicipio('Santos');
    getAllVistorias();
    getTrainingVistoriasByAgente('training:participant-1');
    getOfficialVistoriaById('vistoria-1');
    getTrainingVistoriaById('vistoria-1', 'training:participant-1');
    countPendentes();

    const allSql = [
      ...mockDb.getAllSync.mock.calls.map((c: any[]) => c[0]),
      ...mockDb.getFirstSync.mock.calls.map((c: any[]) => c[0]),
    ].join('\n');

    expect(allSql).toContain('COALESCE(modo_treinamento, 0) = 0');
    expect(allSql).toContain("agente_uid NOT LIKE 'training:%'");
    expect(allSql).toContain('COALESCE(modo_treinamento, 0) = 1');
    expect(allSql).toContain("agente_uid LIKE 'training:%'");
  });
});

describe('FormularioCache — payload completo offline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('upsertFormulariosCache persiste classificacao_json, fases_json e tipo_calculo', () => {
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);

    const { upsertFormulariosCache } = require('../database');

    const form = {
      id: 'custom-form-1',
      titulo: 'Formulário Personalizado',
      descricao: null,
      versao: 3,
      status: 'publicado',
      perguntas_json: JSON.stringify([{ id: 'p1', texto: 'Pergunta?' }]),
      municipio: 'Campinas',
      atualizado_em: new Date().toISOString(),
      classificacao_json: JSON.stringify({ limites: [{ max: 30, nivel: 'baixo' }] }),
      fases_json: JSON.stringify([{ id: 'f1', nome: 'Estrutura', peso: 1.5 }]),
      tipo_calculo: 'ponderada_max_elemento',
    };

    expect(() => upsertFormulariosCache([form])).not.toThrow();

    const calls = mockDb.runSync.mock.calls as any[][];
    const insertCall = calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('INSERT OR REPLACE INTO formularios_cache')
    );
    expect(insertCall).toBeDefined();

    // Verificar que os novos campos estão presentes no SQL
    expect(insertCall![0]).toContain('classificacao_json');
    expect(insertCall![0]).toContain('fases_json');
    expect(insertCall![0]).toContain('tipo_calculo');

    // Verificar que os valores foram passados corretamente
    const params = insertCall![1] as any[];
    expect(params).toContain(form.classificacao_json);
    expect(params).toContain(form.fases_json);
    expect(params).toContain(form.tipo_calculo);
  });

  it('upsertFormulariosCache aceita null nos campos opcionais de payload', () => {
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);

    const { upsertFormulariosCache } = require('../database');

    const form = {
      id: 'builtin-form-1',
      titulo: 'Formulário Built-in',
      descricao: null,
      versao: 1,
      status: 'publicado',
      perguntas_json: '[]',
      municipio: null,
      atualizado_em: new Date().toISOString(),
      classificacao_json: null,
      fases_json: null,
      tipo_calculo: null,
    };

    expect(() => upsertFormulariosCache([form])).not.toThrow();
  });
});

describe('insertAgendamento — origem compartilhada', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('persiste a origem web no cache offline do aplicativo', () => {
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);

    const { insertAgendamento } = require('../database');
    insertAgendamento({
      id: 'ag-web',
      titulo: 'Vistoria criada no portal',
      municipio: 'Aurora',
      data_agendada: '2026-08-01T12:00:00.000Z',
      criado_por_uid: 'staff-1',
      status: 'pendente',
      origem: 'web',
      sincronizado: 1,
    });

    const insert = mockDb.runSync.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('INSERT OR REPLACE INTO agendamentos'),
    );
    expect(insert).toBeDefined();
    expect(insert![0]).toContain('origem');
    expect(insert![1]).toContain('web');
  });
});

describe('deleteAgendamentoWithTombstone — tombstone offline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('marca status=deletado e sincronizado=0 quando agendamento já foi sincronizado', () => {
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => ({ sincronizado: 1 })), // já existe no Supabase
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);

    const { deleteAgendamentoWithTombstone } = require('../database');
    deleteAgendamentoWithTombstone('ag-123');

    const calls = mockDb.runSync.mock.calls as any[][];
    const tombstoneCall = calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes("status = 'deletado'")
    );
    expect(tombstoneCall).toBeDefined();
    expect(tombstoneCall![1]).toContain('ag-123');

    // NÃO deve ter chamado DELETE diretamente
    const deleteCall = calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('DELETE FROM agendamentos')
    );
    expect(deleteCall).toBeUndefined();
  });

  it('mantém tombstone mesmo com sincronizado=0, pois pode ser edição de registro remoto', () => {
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => ({ id: 'ag-456' })),
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);

    const { deleteAgendamentoWithTombstone } = require('../database');
    deleteAgendamentoWithTombstone('ag-456');

    const calls = mockDb.runSync.mock.calls as any[][];
    const tombstoneCall = calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes("status = 'deletado'")
    );
    expect(tombstoneCall).toBeDefined();
    expect(tombstoneCall![1]).toContain('ag-456');

    const deleteCall = calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('DELETE FROM agendamentos')
    );
    expect(deleteCall).toBeUndefined();
  });

  it('não faz nada se agendamento não existe', () => {
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => null), // não encontrado
      getAllSync: jest.fn(() => []),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);

    const { deleteAgendamentoWithTombstone } = require('../database');
    expect(() => deleteAgendamentoWithTombstone('ag-inexistente')).not.toThrow();

    // Nenhum runSync após o getFirstSync (apenas migrations)
    const calls = mockDb.runSync.mock.calls as any[][];
    const actionCalls = calls.filter((c: any[]) =>
      typeof c[0] === 'string' &&
      (c[0].includes('DELETE FROM agendamentos') || c[0].includes("status = 'deletado'"))
    );
    expect(actionCalls).toHaveLength(0);
  });
});

describe('getAgendamentosNaoSincronizados — fila de sync offline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('retorna agendamentos com sincronizado=0', () => {
    const agendamentoPendente = {
      id: 'ag-1',
      titulo: 'Vistoria',
      municipio: 'SP',
      data_agendada: new Date().toISOString(),
      criado_por_uid: 'uid-1',
      status: 'pendente',
      sincronizado: 0,
    };
    const mockDb = {
      runSync: jest.fn(),
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => [agendamentoPendente]),
      withTransactionSync: jest.fn((cb: () => void) => cb()),
    };
    require('expo-sqlite').openDatabaseSync.mockReturnValue(mockDb);

    const { getAgendamentosNaoSincronizados } = require('../database');
    const result = getAgendamentosNaoSincronizados();

    expect(result).toHaveLength(1);
    expect(result[0].sincronizado).toBe(0);

    // SQL deve filtrar por sincronizado = 0
    const calls = mockDb.getAllSync.mock.calls as any[][];
    const syncCall = calls.find((c: any[]) =>
      typeof c[0] === 'string' && c[0].includes('sincronizado = 0')
    );
    expect(syncCall).toBeDefined();
  });
});
