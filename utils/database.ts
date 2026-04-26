import * as SQLite from 'expo-sqlite';

const DB_NAME = 'defesa_civil.db';
const DB_VERSION = 12;

let db: SQLite.SQLiteDatabase | null = null;

// ─── Abertura e migrations ─────────────────────────────────────────────────

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    runMigrations(db);
  }
  return db;
}

function runMigrations(database: SQLite.SQLiteDatabase) {
  // Tabela de controle de versão
  database.runSync(`
    CREATE TABLE IF NOT EXISTS db_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const row = database.getFirstSync<{ value: string }>(
    `SELECT value FROM db_meta WHERE key = 'version'`
  );
  const currentVersion = row ? parseInt(row.value) : 0;

  // Todas as migrations rodam dentro de uma única transação atômica
  // para garantir que DB nunca fique em estado corrompido
  database.withTransactionSync(() => {
    if (currentVersion < 1) {
      database.runSync(`
        CREATE TABLE IF NOT EXISTS vistorias_offline (
          id TEXT PRIMARY KEY,
          agente_uid TEXT NOT NULL,
          agente_nome TEXT,
          municipio TEXT,
          endereco_rua TEXT,
          endereco_numero TEXT,
          endereco_bairro TEXT,
          endereco_cep TEXT,
          responsavel_nome TEXT,
          latitude REAL,
          longitude REAL,
          data_vistoria TEXT,
          formulario_id TEXT,
          formulario_versao INTEGER,
          respostas_json TEXT,
          nivel_risco TEXT,
          pontuacao_total INTEGER,
          foto_url TEXT,
          sincronizado INTEGER DEFAULT 0,
          erro_sync TEXT,
          criado_em TEXT NOT NULL
        )
      `);
    }

    if (currentVersion < 2) {
      // Adiciona coluna de URLs de evidências fotográficas (array JSON)
      try {
        database.runSync(
          `ALTER TABLE vistorias_offline ADD COLUMN fotos_urls TEXT`
        );
      } catch {
        // Coluna já existe (pode acontecer em instâncias que rodaram v2 parcialmente)
      }
    }

    if (currentVersion < 3) {
      // Contador de tentativas de sync (evita retry infinito em erros permanentes)
      try {
        database.runSync(
          `ALTER TABLE vistorias_offline ADD COLUMN tentativas_sync INTEGER DEFAULT 0`
        );
      } catch { /* já existe */ }

      // Tabela de logs estruturados (persistidos offline)
      database.runSync(`
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          level TEXT NOT NULL,
          category TEXT NOT NULL,
          message TEXT NOT NULL,
          data TEXT,
          criado_em TEXT NOT NULL
        )
      `);
    }

    if (currentVersion < 4) {
      // Índices para melhorar performance das queries mais frequentes
      database.runSync(`CREATE INDEX IF NOT EXISTS idx_vistorias_agente ON vistorias_offline (agente_uid)`);
      database.runSync(`CREATE INDEX IF NOT EXISTS idx_vistorias_municipio ON vistorias_offline (municipio)`);
      database.runSync(`CREATE INDEX IF NOT EXISTS idx_vistorias_sincronizado ON vistorias_offline (sincronizado)`);
      database.runSync(`CREATE INDEX IF NOT EXISTS idx_vistorias_data ON vistorias_offline (data_vistoria DESC)`);
      database.runSync(`CREATE INDEX IF NOT EXISTS idx_vistorias_nivel ON vistorias_offline (nivel_risco)`);
      database.runSync(`CREATE INDEX IF NOT EXISTS idx_logs_level_data ON logs (level, criado_em DESC)`);
    }

    if (currentVersion < 5) {
      // Cache local de formulários personalizados para uso offline
      database.runSync(`
        CREATE TABLE IF NOT EXISTS formularios_cache (
          id TEXT PRIMARY KEY,
          titulo TEXT NOT NULL,
          descricao TEXT,
          versao INTEGER NOT NULL,
          status TEXT NOT NULL,
          perguntas_json TEXT NOT NULL,
          municipio TEXT,
          atualizado_em TEXT NOT NULL,
          cached_at TEXT NOT NULL
        )
      `);
      database.runSync(`
        CREATE INDEX IF NOT EXISTS idx_formularios_municipio ON formularios_cache (municipio)
      `);
    }

    if (currentVersion < 6) {
      // Tabela de agendamentos para vistorias agendadas
      database.runSync(`
        CREATE TABLE IF NOT EXISTS agendamentos (
          id TEXT PRIMARY KEY,
          titulo TEXT NOT NULL,
          endereco TEXT,
          municipio TEXT NOT NULL,
          data_agendada TEXT NOT NULL,
          criado_por_uid TEXT NOT NULL,
          criado_por_nome TEXT,
          agente_uid TEXT,
          agente_nome TEXT,
          lat REAL,
          lng REAL,
          observacoes TEXT,
          status TEXT DEFAULT 'pendente',
          criado_em TEXT,
          sincronizado INTEGER DEFAULT 0
        )
      `);
      database.runSync(`
        CREATE INDEX IF NOT EXISTS idx_agendamentos_municipio ON agendamentos (municipio)
      `);
      database.runSync(`
        CREATE INDEX IF NOT EXISTS idx_agendamentos_agente ON agendamentos (agente_uid)
      `);
      database.runSync(`
        CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos (status)
      `);
    }

    if (currentVersion < 7) {
      // Storage URLs e município de origem do agente
      try { database.runSync(`ALTER TABLE vistorias_offline ADD COLUMN laudo_url TEXT`); } catch { /* já existe */ }
      try { database.runSync(`ALTER TABLE vistorias_offline ADD COLUMN laudo_gerado_em TEXT`); } catch { /* já existe */ }
      try { database.runSync(`ALTER TABLE vistorias_offline ADD COLUMN municipio_agente TEXT`); } catch { /* já existe */ }
    }

    if (currentVersion < 8) {
      // Grupos de agentes e membros
      database.runSync(`
        CREATE TABLE IF NOT EXISTS grupos (
          id TEXT PRIMARY KEY,
          nome TEXT NOT NULL,
          municipio TEXT NOT NULL,
          criado_em TEXT NOT NULL
        )
      `);
      database.runSync(`
        CREATE TABLE IF NOT EXISTS grupo_membros (
          grupo_id TEXT NOT NULL,
          agente_uid TEXT NOT NULL,
          agente_nome TEXT NOT NULL,
          PRIMARY KEY (grupo_id, agente_uid),
          FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE
        )
      `);
      database.runSync(`
        CREATE INDEX IF NOT EXISTS idx_grupos_municipio ON grupos (municipio)
      `);
      database.runSync(`
        CREATE INDEX IF NOT EXISTS idx_grupo_membros_grupo ON grupo_membros (grupo_id)
      `);
    }

    if (currentVersion < 9) {
      // Rastreia se a vistoria foi criada com internet (1) ou offline (0)
      // NULL = registros antigos (sem informação de origem)
      try { database.runSync(`ALTER TABLE vistorias_offline ADD COLUMN feita_online INTEGER`); } catch { /* já existe */ }
    }

    if (currentVersion < 10) {
      // Vincula agendamento à vistoria gerada a partir dele
      try { database.runSync(`ALTER TABLE agendamentos ADD COLUMN vistoria_id TEXT`); } catch { /* já existe */ }
    }

    if (currentVersion < 11) {
      // Tombstone para delete offline: status 'deletado' marca registros a serem
      // excluídos no Supabase quando a conexão for restaurada.
      // O campo sincronizado=0 combinado com status='deletado' aciona o delete remoto no SyncService.
      // Registros antigos sem o campo já funcionam corretamente (status IN ('pendente','concluido','cancelado')).
      // Nenhuma coluna nova necessária — o campo status já existe e suporta string livre.
      // Apenas índice adicional para acelerar a query de pendentes.
      try {
        database.runSync(`CREATE INDEX IF NOT EXISTS idx_agendamentos_sincronizado ON agendamentos (sincronizado)`);
      } catch { /* já existe */ }
    }

    if (currentVersion < 12) {
      // Payload completo para formulários personalizados no cache offline.
      // classificacao_json: limites de risco (JSON) — necessário para calcular nivel_risco offline
      // fases_json: estrutura de fases/elementos ponderados — necessário para tipoCalculo ponderada_max_elemento
      // tipo_calculo: string do tipo de cálculo ('soma_total' | 'ponderada_max_elemento')
      try { database.runSync(`ALTER TABLE formularios_cache ADD COLUMN classificacao_json TEXT`); } catch { /* já existe */ }
      try { database.runSync(`ALTER TABLE formularios_cache ADD COLUMN fases_json TEXT`); } catch { /* já existe */ }
      try { database.runSync(`ALTER TABLE formularios_cache ADD COLUMN tipo_calculo TEXT`); } catch { /* já existe */ }
    }

    database.runSync(
      `INSERT OR REPLACE INTO db_meta (key, value) VALUES ('version', ?)`,
      [String(DB_VERSION)]
    );
  });
}

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface VistoriaLocal {
  id: string;
  agente_uid: string;
  agente_nome: string;
  municipio: string;
  endereco_rua: string;
  endereco_numero: string;
  endereco_bairro: string;
  endereco_cep: string | null;
  responsavel_nome: string | null;
  latitude: number | null;
  longitude: number | null;
  data_vistoria: string;
  formulario_id: string;
  formulario_versao: number;
  respostas_json: string;
  nivel_risco: string;
  pontuacao_total: number;
  foto_url: string | null;
  fotos_urls: string | null;    // JSON array de URLs (["url1","url2"])
  municipio_agente: string | null; // município de origem do agente
  laudo_url: string | null;     // URL signed do PDF no Storage
  laudo_gerado_em: string | null; // ISO timestamp da última geração
  feita_online: number | null;  // 1 = feita com internet, 0 = feita offline, NULL = desconhecido (registro antigo)
  sincronizado: number;         // 0 = pendente, 1 = sincronizado
  erro_sync: string | null;
  tentativas_sync: number;      // contador de tentativas falhas
  criado_em: string;
  origem?: 'offline' | 'online'; // campo computado, não persiste no SQLite
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

export function insertVistoria(
  vistoria: Omit<VistoriaLocal, 'sincronizado' | 'erro_sync' | 'fotos_urls' | 'tentativas_sync' | 'municipio_agente' | 'laudo_url' | 'laudo_gerado_em'> & { municipio_agente?: string | null; laudo_url?: string | null; laudo_gerado_em?: string | null }
): void {
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO vistorias_offline (
      id, agente_uid, agente_nome, municipio, municipio_agente,
      endereco_rua, endereco_numero, endereco_bairro, endereco_cep,
      responsavel_nome, latitude, longitude, data_vistoria,
      formulario_id, formulario_versao, respostas_json,
      nivel_risco, pontuacao_total, foto_url, fotos_urls,
      laudo_url, laudo_gerado_em, feita_online, sincronizado, criado_em
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)`,
    [
      vistoria.id,
      vistoria.agente_uid,
      vistoria.agente_nome,
      vistoria.municipio,
      vistoria.municipio_agente ?? null,
      vistoria.endereco_rua,
      vistoria.endereco_numero,
      vistoria.endereco_bairro,
      vistoria.endereco_cep ?? null,
      vistoria.responsavel_nome ?? null,
      vistoria.latitude,
      vistoria.longitude,
      vistoria.data_vistoria,
      vistoria.formulario_id,
      vistoria.formulario_versao,
      vistoria.respostas_json,
      vistoria.nivel_risco,
      vistoria.pontuacao_total,
      vistoria.foto_url ?? null,
      null, // fotos_urls — preenchido separadamente pela FotoScreen
      vistoria.laudo_url ?? null,
      vistoria.laudo_gerado_em ?? null,
      vistoria.feita_online ?? null,
      vistoria.criado_em,
    ]
  );
}

export function updateFotosUrls(id: string, urls: string[]): void {
  const database = getDb();
  database.runSync(
    `UPDATE vistorias_offline SET fotos_urls = ? WHERE id = ?`,
    [JSON.stringify(urls), id]
  );
}

export function markSincronizado(id: string): void {
  const database = getDb();
  database.runSync(
    `UPDATE vistorias_offline SET sincronizado = 1, erro_sync = NULL WHERE id = ?`,
    [id]
  );
}

export function markErroSync(id: string, erro: string): void {
  const database = getDb();
  database.runSync(
    `UPDATE vistorias_offline SET erro_sync = ? WHERE id = ?`,
    [erro, id]
  );
}

export function getVistoriasNaoSincronizadas(): VistoriaLocal[] {
  const database = getDb();
  return database.getAllSync<VistoriaLocal>(
    `SELECT * FROM vistorias_offline WHERE sincronizado = 0 ORDER BY criado_em ASC`
  );
}

export function getVistoriasByAgente(agenteUid: string): VistoriaLocal[] {
  const database = getDb();
  return database.getAllSync<VistoriaLocal>(
    `SELECT * FROM vistorias_offline WHERE agente_uid = ? ORDER BY criado_em DESC LIMIT 50`,
    [agenteUid]
  );
}

export function getVistoriasByMunicipio(municipio: string): VistoriaLocal[] {
  const database = getDb();
  return database.getAllSync<VistoriaLocal>(
    `SELECT * FROM vistorias_offline WHERE municipio = ? ORDER BY criado_em DESC LIMIT 50`,
    [municipio]
  );
}

export function getAllVistorias(): VistoriaLocal[] {
  const database = getDb();
  return database.getAllSync<VistoriaLocal>(
    `SELECT * FROM vistorias_offline ORDER BY criado_em DESC LIMIT 200`
  );
}

export function updateLaudoUrl(id: string, laudoUrl: string, laudoGeradoEm: string): void {
  const database = getDb();
  database.runSync(
    `UPDATE vistorias_offline SET laudo_url = ?, laudo_gerado_em = ? WHERE id = ?`,
    [laudoUrl, laudoGeradoEm, id]
  );
}

export function updateFotoUrl(id: string, fotoUrl: string): void {
  const database = getDb();
  database.runSync(
    `UPDATE vistorias_offline SET foto_url = ? WHERE id = ?`,
    [fotoUrl, id]
  );
}

export function getVistoriaById(id: string): VistoriaLocal | null {
  const database = getDb();
  return database.getFirstSync<VistoriaLocal>(
    `SELECT * FROM vistorias_offline WHERE id = ?`,
    [id]
  ) ?? null;
}

export function deleteVistoriaOffline(id: string): void {
  const database = getDb();
  database.runSync(`DELETE FROM vistorias_offline WHERE id = ?`, [id]);
}

export function incrementTentativasSync(id: string): void {
  const database = getDb();
  database.runSync(
    `UPDATE vistorias_offline SET tentativas_sync = COALESCE(tentativas_sync, 0) + 1 WHERE id = ?`,
    [id]
  );
}

export function resetTentativasSync(id: string): void {
  const database = getDb();
  database.runSync(
    `UPDATE vistorias_offline SET tentativas_sync = 0, erro_sync = NULL WHERE id = ?`,
    [id]
  );
}

export function countPendentes(): number {
  const database = getDb();
  const row = database.getFirstSync<{ total: number }>(
    `SELECT COUNT(*) as total FROM vistorias_offline WHERE sincronizado = 0`
  );
  return row?.total ?? 0;
}

// ─── Formulários cache ──────────────────────────────────────────────────────

export interface FormularioCache {
  id: string;
  titulo: string;
  descricao: string | null;
  versao: number;
  status: string;
  perguntas_json: string;
  municipio: string | null;
  atualizado_em: string;
  cached_at: string;
  /** JSON dos limites de classificação de risco (ex: [{max:30,nivel:'baixo'},...]) */
  classificacao_json: string | null;
  /** JSON das fases/elementos (necessário para tipoCalculo ponderada_max_elemento) */
  fases_json: string | null;
  /** Tipo de cálculo: 'soma_total' | 'ponderada_max_elemento' */
  tipo_calculo: string | null;
}

export function upsertFormulariosCache(forms: Omit<FormularioCache, 'cached_at'>[]): void {
  const database = getDb();
  const now = new Date().toISOString();
  database.withTransactionSync(() => {
    for (const f of forms) {
      database.runSync(
        `INSERT OR REPLACE INTO formularios_cache
          (id, titulo, descricao, versao, status, perguntas_json, municipio, atualizado_em, cached_at,
           classificacao_json, fases_json, tipo_calculo)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          f.id, f.titulo, f.descricao ?? null, f.versao, f.status, f.perguntas_json,
          f.municipio ?? null, f.atualizado_em, now,
          f.classificacao_json ?? null, f.fases_json ?? null, f.tipo_calculo ?? null,
        ]
      );
    }
  });
}

export function getFormulariosCache(municipio?: string): FormularioCache[] {
  const database = getDb();
  if (municipio) {
    return database.getAllSync<FormularioCache>(
      `SELECT * FROM formularios_cache WHERE municipio = ? OR municipio IS NULL ORDER BY atualizado_em DESC`,
      [municipio]
    );
  }
  return database.getAllSync<FormularioCache>(
    `SELECT * FROM formularios_cache ORDER BY atualizado_em DESC`
  );
}

export function getFormularioCacheById(id: string): FormularioCache | null {
  const database = getDb();
  return database.getFirstSync<FormularioCache>(
    `SELECT * FROM formularios_cache WHERE id = ?`,
    [id]
  ) ?? null;
}

// ─── Agendamentos ───────────────────────────────────────────────────────────

import type { AgendamentoLocal } from '../types/agendamento';

export function insertAgendamento(a: AgendamentoLocal): void {
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO agendamentos (
      id, titulo, endereco, municipio, data_agendada,
      criado_por_uid, criado_por_nome, agente_uid, agente_nome,
      lat, lng, observacoes, status, criado_em, sincronizado
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      a.id,
      a.titulo,
      a.endereco ?? null,
      a.municipio,
      a.data_agendada,
      a.criado_por_uid,
      a.criado_por_nome ?? null,
      a.agente_uid ?? null,
      a.agente_nome ?? null,
      a.lat ?? null,
      a.lng ?? null,
      a.observacoes ?? null,
      a.status,
      a.criado_em ?? new Date().toISOString(),
      a.sincronizado ?? 0,
    ]
  );
}

export function getAgendamentosByMunicipio(municipio: string): AgendamentoLocal[] {
  const database = getDb();
  return database.getAllSync<AgendamentoLocal>(
    `SELECT * FROM agendamentos WHERE municipio = ? ORDER BY data_agendada ASC`,
    [municipio]
  );
}

export function getAgendamentosByAgente(agenteUid: string, municipio?: string): AgendamentoLocal[] {
  const database = getDb();
  if (municipio) {
    // Agente vê seus agendamentos + agendamentos sem atribuição do mesmo município
    return database.getAllSync<AgendamentoLocal>(
      `SELECT * FROM agendamentos WHERE municipio = ? AND (agente_uid = ? OR agente_uid IS NULL) ORDER BY data_agendada ASC`,
      [municipio, agenteUid]
    );
  }
  return database.getAllSync<AgendamentoLocal>(
    `SELECT * FROM agendamentos WHERE agente_uid = ? ORDER BY data_agendada ASC`,
    [agenteUid]
  );
}

export function getAgendamentoById(id: string): AgendamentoLocal | null {
  const database = getDb();
  return database.getFirstSync<AgendamentoLocal>(
    `SELECT * FROM agendamentos WHERE id = ?`,
    [id]
  ) ?? null;
}

export function updateAgendamentoStatus(id: string, status: string): void {
  const database = getDb();
  database.runSync(
    `UPDATE agendamentos SET status = ?, sincronizado = 0 WHERE id = ?`,
    [status, id]
  );
}

export function deleteAgendamento(id: string): void {
  const database = getDb();
  database.runSync(`DELETE FROM agendamentos WHERE id = ?`, [id]);
}

/**
 * Exclui agendamento com tombstone para sync offline.
 * - Se sincronizado=1 (já existe no Supabase): marca status='deletado' e sincronizado=0
 *   para que o SyncService execute o delete remoto na próxima sincronização.
 * - Se sincronizado=0 (nunca foi ao Supabase): remove diretamente, sem tombstone necessário.
 */
export function deleteAgendamentoWithTombstone(id: string): void {
  const database = getDb();
  const ag = database.getFirstSync<{ sincronizado: number }>(
    `SELECT sincronizado FROM agendamentos WHERE id = ?`,
    [id]
  );
  if (!ag) return;

  if (ag.sincronizado === 1) {
    // Já existe no Supabase — marcar para deleção remota
    database.runSync(
      `UPDATE agendamentos SET status = 'deletado', sincronizado = 0 WHERE id = ?`,
      [id]
    );
  } else {
    // Nunca sincronizado — pode remover localmente sem traces
    database.runSync(`DELETE FROM agendamentos WHERE id = ?`, [id]);
  }
}

export function countAgendamentosPendentes(municipio: string): number {
  const database = getDb();
  const row = database.getFirstSync<{ total: number }>(
    `SELECT COUNT(*) as total FROM agendamentos WHERE municipio = ? AND status = 'pendente'`,
    [municipio]
  );
  return row?.total ?? 0;
}

export function countAgendamentosPendentesAgente(agenteUid: string): number {
  const database = getDb();
  const row = database.getFirstSync<{ total: number }>(
    `SELECT COUNT(*) as total FROM agendamentos WHERE agente_uid = ? AND status = 'pendente'`,
    [agenteUid]
  );
  return row?.total ?? 0;
}

export function getAllAgendamentos(): AgendamentoLocal[] {
  const database = getDb();
  return database.getAllSync<AgendamentoLocal>(
    `SELECT * FROM agendamentos ORDER BY data_agendada ASC LIMIT 500`
  );
}

export function getAgendamentosNaoSincronizados(): AgendamentoLocal[] {
  const database = getDb();
  return database.getAllSync<AgendamentoLocal>(
    `SELECT * FROM agendamentos WHERE sincronizado = 0`
  );
}

export function updateAgendamentoVistoriaId(id: string, vistoriaId: string): void {
  const database = getDb();
  database.runSync(
    `UPDATE agendamentos SET status = 'concluido', vistoria_id = ?, sincronizado = 0 WHERE id = ?`,
    [vistoriaId, id]
  );
}

export function markAgendamentoSincronizado(id: string): void {
  const database = getDb();
  database.runSync(
    `UPDATE agendamentos SET sincronizado = 1 WHERE id = ?`,
    [id]
  );
}

// ─── Grupos ──────────────────────────────────────────────────────────────────

export interface GrupoLocal {
  id: string;
  nome: string;
  municipio: string;
  criado_em: string;
}

export interface GrupoMembro {
  grupo_id: string;
  agente_uid: string;
  agente_nome: string;
}

export function insertGrupo(g: GrupoLocal): void {
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO grupos (id, nome, municipio, criado_em) VALUES (?, ?, ?, ?)`,
    [g.id, g.nome, g.municipio, g.criado_em]
  );
}

export function getGruposByMunicipio(municipio: string): GrupoLocal[] {
  const database = getDb();
  return database.getAllSync<GrupoLocal>(
    `SELECT * FROM grupos WHERE municipio = ? ORDER BY criado_em DESC`,
    [municipio]
  );
}

export function deleteGrupo(id: string): void {
  const database = getDb();
  database.runSync(`DELETE FROM grupo_membros WHERE grupo_id = ?`, [id]);
  database.runSync(`DELETE FROM grupos WHERE id = ?`, [id]);
}

export function addMembroGrupo(m: GrupoMembro): void {
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO grupo_membros (grupo_id, agente_uid, agente_nome) VALUES (?, ?, ?)`,
    [m.grupo_id, m.agente_uid, m.agente_nome]
  );
}

export function removeMembroGrupo(grupoId: string, agenteUid: string): void {
  const database = getDb();
  database.runSync(
    `DELETE FROM grupo_membros WHERE grupo_id = ? AND agente_uid = ?`,
    [grupoId, agenteUid]
  );
}

export function getMembrosGrupo(grupoId: string): GrupoMembro[] {
  const database = getDb();
  return database.getAllSync<GrupoMembro>(
    `SELECT * FROM grupo_membros WHERE grupo_id = ?`,
    [grupoId]
  );
}

export function getGrupoMemberCount(grupoId: string): number {
  const database = getDb();
  const row = database.getFirstSync<{ total: number }>(
    `SELECT COUNT(*) as total FROM grupo_membros WHERE grupo_id = ?`,
    [grupoId]
  );
  return row?.total ?? 0;
}
