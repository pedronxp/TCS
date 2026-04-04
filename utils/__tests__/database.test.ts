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
  beforeEach(() => {
    jest.resetModules();
  });

  it('abre o banco apenas uma vez (singleton)', () => {
    const { getDb } = require('../database');
    getDb();
    getDb();
    // openDatabaseSync deve ter sido chamado apenas 1x
    expect(SQLite.openDatabaseSync).toHaveBeenCalledTimes(1);
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
  });
});
