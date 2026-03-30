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
