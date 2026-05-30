import { AppState, AppStateStatus } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase } from '../utils/supabase';
import {
  getVistoriasNaoSincronizadas,
  markSincronizado,
  markErroSync,
  incrementTentativasSync,
  VistoriaLocal,
  getDb,
  getAgendamentosNaoSincronizados,
  markAgendamentoSincronizado,
  deleteAgendamento,
} from '../utils/database';
import { logger } from '../utils/logger';
import { uploadImageFromLocalUri } from './StorageService';
import { checkRealInternet } from '../context/ConnectivityContext';

// ─── Configuração ──────────────────────────────────────────────────────────

const MAX_TENTATIVAS_SYNC = 5;
const BATCH_SIZE = 20;
const VACUUM_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas
const VACUUM_LAST_KEY = '@vacuum_last_run';

const BACKGROUND_TASK_ID = 'DEFESA_CIVIL_SYNC';
const APP_STATE_DEBOUNCE_MS = 3000;

// Auto-retry config
const MAX_AUTO_RETRIES = 3;
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000]; // 30s, 1min, 2min

// ─── Wrappers de notificação ───────────────────────────────────────────────

async function notificarSucesso(count: number): Promise<void> {
  if (Constants.appOwnership === 'expo') return;
  try {
    const { notificarSincronizacao } = await import('./NotificationService');
    await notificarSincronizacao(count);
  } catch { /* não crítico */ }
}

async function notificarFalha(falhas: number, proxRetrySegundos: number): Promise<void> {
  if (Constants.appOwnership === 'expo') return;
  try {
    const { notificarSyncFalha } = await import('./NotificationService');
    await notificarSyncFalha(falhas, proxRetrySegundos);
  } catch { /* não crítico */ }
}

async function notificarRetrying(tentativa: number): Promise<void> {
  if (Constants.appOwnership === 'expo') return;
  try {
    const { notificarSyncRetrying } = await import('./NotificationService');
    await notificarSyncRetrying(tentativa);
  } catch { /* não crítico */ }
}

async function notificarDesistiu(falhas: number): Promise<void> {
  if (Constants.appOwnership === 'expo') return;
  try {
    const { notificarSyncDesistiu } = await import('./NotificationService');
    await notificarSyncDesistiu(falhas);
  } catch { /* não crítico */ }
}

// ─── Guard de concorrência ─────────────────────────────────────────────────

let _syncInProgress = false;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;
let _currentRetryAttempt = 0;

// ─── Controle de VACUUM ────────────────────────────────────────────────────

async function shouldRunVacuum(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VACUUM_LAST_KEY);
    if (!raw) return true;
    const last = parseInt(raw, 10);
    return Date.now() - last >= VACUUM_INTERVAL_MS;
  } catch {
    return false;
  }
}

async function markVacuumRun(): Promise<void> {
  try {
    await AsyncStorage.setItem(VACUUM_LAST_KEY, String(Date.now()));
  } catch { /* não crítico */ }
}

// ─── Sincronização principal ───────────────────────────────────────────────

/**
 * Envia todas as vistorias pendentes para o Supabase.
 * Chamado manualmente, ao reconectar, ou via background task.
 * Protegido contra execuções simultâneas.
 *
 * @param isRetry se true, este é um auto-retry (não agenda outro retry em cascata)
 */
export async function syncPendentes(isRetry = false): Promise<{ sucesso: number; falha: number }> {
  if (_syncInProgress) return { sucesso: 0, falha: 0 };

  // Verificar conexão real antes de consumir a fila.
  // Se não há internet real: sair silenciosamente sem incrementar tentativas nem agendar retry.
  const online = await checkRealInternet();
  if (!online) {
    logger.info('sync', 'Sem internet real — sync adiado, fila preservada');
    return { sucesso: 0, falha: 0 };
  }

  _syncInProgress = true;

  let sucesso = 0;
  let falha = 0;

  try {
    const pendentes = getVistoriasNaoSincronizadas();

    // Sincronizar agendamentos mesmo quando não há vistorias pendentes
    try {
      await syncAgendamentos();
    } catch (e: any) {
      logger.warn('sync', `Falha no sync de agendamentos: ${e?.message}`);
    }

    if (pendentes.length === 0) return { sucesso: 0, falha: 0 };
    logger.info('sync', `Iniciando sync: ${pendentes.length} pendente(s)${isRetry ? ` (retry #${_currentRetryAttempt})` : ''}`);

    // Separar elegíveis (dentro do limite de tentativas) de esgotados
    const elegiveis = pendentes.filter(v => (v.tentativas_sync ?? 0) < MAX_TENTATIVAS_SYNC);
    const esgotados = pendentes.filter(v => (v.tentativas_sync ?? 0) >= MAX_TENTATIVAS_SYNC);

    esgotados.forEach(v => {
      logger.warn('sync', `Vistoria ignorada — limite de tentativas atingido`, {
        id: v.id, tentativas: v.tentativas_sync, ultimo_erro: v.erro_sync,
      });
    });

    // Processar em lotes para reduzir número de requests
    for (let i = 0; i < elegiveis.length; i += BATCH_SIZE) {
      const lote = elegiveis.slice(i, i + BATCH_SIZE);

      // --- Passo Intermediário: Processar uploads de fotos ---
      const loteProntoParaSync: typeof lote = [];
      for (let v of lote) {
        try {
            v = await processarImagensVistoria(v);
            loteProntoParaSync.push(v);
        } catch (err: any) {
            const tentativaAtual = (v.tentativas_sync ?? 0) + 1;
            incrementTentativasSync(v.id);
            markErroSync(v.id, `Erro Upload Imagem: ${err.message ?? 'Desconhecido'}`);
            falha++;
            logger.error('sync', `Falha Mídia individual (tentativa ${tentativaAtual}/${MAX_TENTATIVAS_SYNC})`, {
                id: v.id, erro: err.message,
            });
        }
      }

      const payloads = loteProntoParaSync.map(buildSupabasePayload);

      if (payloads.length === 0) continue;

      try {
        const { error } = await supabase.from('vistorias').upsert(payloads);
        if (error) throw error;

        // Marcar como concluido apenas quando os dados e a midia remota estiverem completos.
        loteProntoParaSync.forEach(v => {
          if (hasMidiaLocalPendente(v)) {
            markErroSync(v.id, 'Dados enviados; mídia local pendente de upload.');
            falha++;
            logger.warn('sync', 'Dados sincronizados, mas a vistoria permanece pendente por midia local', { id: v.id });
          } else {
            markSincronizado(v.id);
            sucesso++;
          }
        });
        logger.info('sync', `Lote sincronizado: ${loteProntoParaSync.length} vistoria(s)`, {
          indices: `${i}–${i + loteProntoParaSync.length - 1}`,
        });
      } catch (e: any) {
        // Lote falhou — tentar individualmente para isolar o registro problemático
        for (const vistoria of loteProntoParaSync) {
          try {
            const { error: errSingle } = await supabase.from('vistorias').upsert(buildSupabasePayload(vistoria));
            if (errSingle) throw errSingle;
            if (hasMidiaLocalPendente(vistoria)) {
              markErroSync(vistoria.id, 'Dados enviados; mídia local pendente de upload.');
              falha++;
              logger.warn('sync', 'Dados sincronizados, mas a vistoria permanece pendente por midia local', { id: vistoria.id });
            } else {
              markSincronizado(vistoria.id);
              sucesso++;
            }
          } catch (e2: any) {
            const tentativaAtual = (vistoria.tentativas_sync ?? 0) + 1;
            incrementTentativasSync(vistoria.id);
            markErroSync(vistoria.id, e2.message ?? 'Erro desconhecido');
            falha++;
            logger.error('sync', `Falha individual (tentativa ${tentativaAtual}/${MAX_TENTATIVAS_SYNC})`, {
              id: vistoria.id, endereco: vistoria.endereco_rua, erro: e2.message,
            });
          }
        }
      }
    }

    // ── Notificações & Auto-retry ──────────────────────────────────────────

    if (sucesso > 0) {
      // VACUUM limitado a 1x/dia
      const vacuum = await shouldRunVacuum();
      if (vacuum) {
        try {
          getDb().runSync('VACUUM');
          await markVacuumRun();
          logger.info('sync', 'VACUUM executado');
        } catch { /* não crítico */ }
      }

      // Reset retry counter on success
      _currentRetryAttempt = 0;
      notificarSucesso(sucesso).catch(() => null);
      logger.info('sync', `Sync concluído — sucesso: ${sucesso}, falha: ${falha}`);
    }

    if (falha > 0) {
      logger.warn('sync', `Sync com falhas — sucesso: ${sucesso}, falha: ${falha}`);

      if (!isRetry) {
        // Primeira falha: iniciar cadeia de auto-retry
        _currentRetryAttempt = 0;
        scheduleAutoRetry(falha);
      } else if (_currentRetryAttempt < MAX_AUTO_RETRIES) {
        // Retry ainda tem tentativas restantes
        scheduleAutoRetry(falha);
      } else {
        // Esgotou auto-retries: notificar que desistiu
        _currentRetryAttempt = 0;
        notificarDesistiu(falha).catch(() => null);
        logger.error('sync', `Auto-retry esgotado após ${MAX_AUTO_RETRIES} tentativas. ${falha} vistorias não sincronizadas.`);
      }
    }
  } finally {
    _syncInProgress = false;
  }

  return { sucesso, falha };
}

/**
 * Agenda um auto-retry com backoff exponencial.
 * Padrão: 30s → 60s → 120s
 */
function scheduleAutoRetry(falhasAtual: number): void {
  // Limpar timer anterior se existir
  if (_retryTimer) {
    clearTimeout(_retryTimer);
    _retryTimer = null;
  }

  const delayMs = RETRY_DELAYS_MS[_currentRetryAttempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  const delaySec = Math.round(delayMs / 1000);
  _currentRetryAttempt++;

  logger.info('sync', `Auto-retry #${_currentRetryAttempt} agendado em ${delaySec}s`, { falhas: falhasAtual });

  // Notificar falha + próximo retry
  notificarFalha(falhasAtual, delaySec).catch(() => null);

  _retryTimer = setTimeout(async () => {
    _retryTimer = null;
    notificarRetrying(_currentRetryAttempt).catch(() => null);
    await syncPendentes(true);
  }, delayMs);
}

/** Cancela qualquer auto-retry pendente */
export function cancelAutoRetry(): void {
  if (_retryTimer) {
    clearTimeout(_retryTimer);
    _retryTimer = null;
    _currentRetryAttempt = 0;
  }
}

/**
 * Reseta tentativas de vistorias esgotadas e sincroniza tudo.
 * Usado pelo botão de sync manual do usuário.
 */
export async function forceSyncAll(): Promise<{ sucesso: number; falha: number }> {
  try {
    const { getDb } = await import('../utils/database');
    getDb().runSync(
      `UPDATE vistorias_offline
       SET tentativas_sync = 0, erro_sync = NULL
       WHERE sincronizado = 0
         AND COALESCE(modo_treinamento, 0) = 0
         AND agente_uid NOT LIKE 'training:%'`
    );
  } catch { /* não crítico */ }
  return syncPendentes();
}

/**
 * Mapeia campos snake_case do SQLite para o schema camelCase do Supabase.
 *
 * Payload verificado contra schema Supabase em 2026-04-03: todas as chaves
 * correspondem às colunas da tabela vistorias (camelCase confirmado via
 * buscas em .eq('agenteUid'), .eq('nivelRisco'), .eq('dataVistoria'), etc.).
 *
 * Status contract: o campo 'status' no Supabase representa o status de negócio
 * da vistoria. Vistorias chegam aqui com status 'concluida' (definido pelo wizard).
 * O SyncService NÃO sobrescreve o status de negócio — apenas garante que a
 * vistoria esteja no Supabase. O campo sincronizado no SQLite controla o estado
 * de sync local.
 */
function buildSupabasePayload(v: VistoriaLocal): Record<string, any> {
  const fotosUrls = (() => {
    try {
      const parsed = v.fotos_urls ? JSON.parse(v.fotos_urls) : [];
      return Array.isArray(parsed)
        ? parsed.filter((url): url is string => typeof url === 'string' && !url.startsWith('file://'))
        : [];
    }
    catch { return []; }
  })();
  const calculoRisco = (() => {
    try { return v.calculo_json ? JSON.parse(v.calculo_json) : null; }
    catch { return null; }
  })();

  // Nunca enviar file:// ao Supabase — se foto ainda for local, omitir
  const fotoUrlSafe = v.foto_url && !v.foto_url.startsWith('file://') ? v.foto_url : null;

  return {
    id: v.id,
    agenteUid: v.agente_uid,
    agenteNome: v.agente_nome,
    municipio: v.municipio,
    enderecoRua: v.endereco_rua,
    enderecoNumero: v.endereco_numero,
    enderecoBairro: v.endereco_bairro,
    enderecoCep: v.endereco_cep,
    responsavelNome: v.responsavel_nome,
    latitude: v.latitude,
    longitude: v.longitude,
    dataVistoria: v.data_vistoria,
    formularioId: v.formulario_id,
    formularioVersao: v.formulario_versao,
    respostasJson: v.respostas_json,
    calculoRisco,
    nivelRisco: v.nivel_risco,
    pontuacaoTotal: v.pontuacao_total,
    fotoUrl: fotoUrlSafe,
    fotosUrls: fotosUrls,
    endereco: `${v.endereco_rua}, ${v.endereco_numero} - ${v.endereco_bairro}`,
    status: 'concluida',
  };
}

function isLocalFileUri(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('file://');
}

function hasMidiaLocalPendente(v: VistoriaLocal): boolean {
  if (isLocalFileUri(v.foto_url)) return true;
  if (!v.fotos_urls) return false;
  try {
    const parsed = JSON.parse(v.fotos_urls);
    return Array.isArray(parsed) && parsed.some(isLocalFileUri);
  } catch {
    return false;
  }
}

/**
 * Sincroniza agendamentos pendentes (criados/editados/excluídos offline).
 * - Agendamentos com sincronizado=0 e sem tombstone: upsert no Supabase
 * - Agendamentos com tombstone (status='deletado'): delete no Supabase + remove local
 */
async function syncAgendamentos(): Promise<void> {
  const pendentes = getAgendamentosNaoSincronizados();
  if (pendentes.length === 0) return;

  logger.info('sync', `Sincronizando ${pendentes.length} agendamento(s) pendente(s)`);

  for (const ag of pendentes) {
    try {
      if (ag.status === 'deletado') {
        // Tombstone: excluir do Supabase e remover registro local
        const { error } = await supabase
          .from('agendamentos')
          .delete()
          .eq('id', ag.id);
        if (!error) {
          deleteAgendamento(ag.id);
          logger.info('sync', `Agendamento deletado remotamente`, { id: ag.id });
        } else {
          logger.warn('sync', `Falha ao deletar agendamento remoto`, { id: ag.id, erro: error.message });
        }
      } else {
        // Criar ou atualizar no Supabase
        const { error } = await supabase
          .from('agendamentos')
          .upsert({
            id: ag.id,
            titulo: ag.titulo,
            endereco: ag.endereco ?? null,
            municipio: ag.municipio,
            data_agendada: ag.data_agendada,
            criado_por_uid: ag.criado_por_uid,
            criado_por_nome: ag.criado_por_nome ?? null,
            agente_uid: ag.agente_uid ?? null,
            agente_nome: ag.agente_nome ?? null,
            lat: ag.lat ?? null,
            lng: ag.lng ?? null,
            observacoes: ag.observacoes ?? null,
            status: ag.status,
            criado_em: ag.criado_em ?? new Date().toISOString(),
            vistoria_id: ag.vistoria_id ?? null,
          });
        if (!error) {
          markAgendamentoSincronizado(ag.id);
          logger.info('sync', `Agendamento sincronizado`, { id: ag.id, status: ag.status });
        } else {
          logger.warn('sync', `Falha ao sincronizar agendamento`, { id: ag.id, erro: error.message });
        }
      }
    } catch (e: any) {
      logger.error('sync', `Erro ao processar agendamento`, { id: ag.id, erro: e?.message });
    }
  }
}

// ─── Background task (funciona no APK buildado, não no Expo Go) ───────────

TaskManager.defineTask(BACKGROUND_TASK_ID, async () => {
  try {
    const { sucesso } = await syncPendentes();
    return sucesso > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_ID, {
      minimumInterval: 15 * 60, // 15 minutos (mínimo Android)
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Expo Go não suporta background tasks — ignorar silenciosamente
  }
}

// ─── Fallback via AppState (funciona no Expo Go) ──────────────────────────

let appStateListener: { remove: () => void } | null = null;
let appStateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function startAppStateSyncListener(): void {
  if (appStateListener) return;

  appStateListener = AppState.addEventListener(
    'change',
    (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;

      // Debounce: evita múltiplos syncs em transições rápidas
      if (appStateDebounceTimer) clearTimeout(appStateDebounceTimer);
      appStateDebounceTimer = setTimeout(() => {
        syncPendentes().catch(() => null);
      }, APP_STATE_DEBOUNCE_MS);
    }
  );
}

export function stopAppStateSyncListener(): void {
  if (appStateDebounceTimer) {
    clearTimeout(appStateDebounceTimer);
    appStateDebounceTimer = null;
  }
  appStateListener?.remove();
  appStateListener = null;
}

// --- Funções Auxiliares para Upload de Fotos Offline ---

/**
 * Escaneia as fotos da vistoria (fotoUrl e fotosUrls do SQLite). 
 * Se contiver URLs locais (file://), faz o upload via Storage e atualiza as strings na vistoria local,
 * persistindo as novas URLs no banco SQLite para que o upload não repita em caso de falha futura.
 */
async function processarImagensVistoria(v: VistoriaLocal): Promise<VistoriaLocal> {
  const db = getDb();
  let sofreuAlteracao = false;

  const ano = new Date(v.data_vistoria).getFullYear();
  const folderPath = `${ano}/${v.municipio || 'indefinido'}/${v.id}`;

  // Processa foto principal (thumb)
  if (v.foto_url && v.foto_url.startsWith('file://')) {
    const remotePath = `${folderPath}/thumb_${Date.now()}.jpg`;
    try {
      v.foto_url = await uploadImageFromLocalUri(v.foto_url, remotePath);
      sofreuAlteracao = true;
    } catch (e: any) {
      logger.warn('sync', 'Falha ao subir foto principal; sync seguira sem fotoUrl remota', {
        id: v.id,
        erro: e?.message ?? String(e),
      });
    }
  }

  // Processa fotos de evidência
  if (v.fotos_urls) {
    try {
      let arrayFotos: string[] = JSON.parse(v.fotos_urls);
      const novasFotos: string[] = [];
      let mudeiFotos = false;

      for (let i = 0; i < arrayFotos.length; i++) {
        const fotoLocal = arrayFotos[i];
        if (fotoLocal.startsWith('file://')) {
          const remotePath = `${folderPath}/evidencia_${i}_${Date.now()}.jpg`;
          try {
            const publicUrl = await uploadImageFromLocalUri(fotoLocal, remotePath);
            novasFotos.push(publicUrl);
            mudeiFotos = true;
          } catch (e: any) {
            novasFotos.push(fotoLocal);
            logger.warn('sync', 'Falha ao subir evidencia; sync seguira sem esta foto remota', {
              id: v.id,
              indice: i,
              erro: e?.message ?? String(e),
            });
          }
        } else {
          novasFotos.push(fotoLocal);
        }
      }

      if (mudeiFotos) {
        v.fotos_urls = JSON.stringify(novasFotos);
        sofreuAlteracao = true;
      }
    } catch {
      // JSON parse error, ignoramos e mantemos o arquivo original.
    }
  }

  // Se fizemos upload de pelo menos uma foto com sucesso, atualizamos a vistoria_offline SQLite.
  if (sofreuAlteracao) {
    db.runSync(
      `UPDATE vistorias_offline SET foto_url = ?, fotos_urls = ? WHERE id = ?`,
      [v.foto_url, v.fotos_urls, v.id]
    );
  }

  return v;
}
