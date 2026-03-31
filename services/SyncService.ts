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
} from '../utils/database';
import { logger } from '../utils/logger';

/**
 * Wrapper de notificação — importação dinâmica para evitar crash do expo-notifications
 * no Expo Go (onde push remoto não é suportado no SDK 53+).
 */
async function notificarSincronizacao(count: number): Promise<void> {
  if (Constants.appOwnership === 'expo') return;
  try {
    const { notificarSincronizacao: notify } = await import('./NotificationService');
    await notify(count);
  } catch { /* não crítico */ }
}

const MAX_TENTATIVAS_SYNC = 5;
const BATCH_SIZE = 20; // Máximo de vistorias por request ao Supabase
const VACUUM_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas
const VACUUM_LAST_KEY = '@vacuum_last_run';

const BACKGROUND_TASK_ID = 'DEFESA_CIVIL_SYNC';
const APP_STATE_DEBOUNCE_MS = 3000;

// ─── Guard de concorrência ─────────────────────────────────────────────────

let _syncInProgress = false;

// ─── Controle de VACUUM ────────────────────────────────────────────────────

async function shouldRunVacuum(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VACUUM_LAST_KEY);
    if (!raw) return true;
    const last = parseInt(raw, 10);
    return Date.now() - last >= VACUUM_INTERVAL_MS;
  } catch {
    return false; // Em caso de erro, não executar VACUUM
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
 */
export async function syncPendentes(): Promise<{ sucesso: number; falha: number }> {
  if (_syncInProgress) return { sucesso: 0, falha: 0 };
  _syncInProgress = true;

  let sucesso = 0;
  let falha = 0;

  try {
    const pendentes = getVistoriasNaoSincronizadas();

    if (pendentes.length === 0) return { sucesso: 0, falha: 0 };
    logger.info('sync', `Iniciando sync: ${pendentes.length} pendente(s)`);

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
      const payloads = lote.map(buildSupabasePayload);

      try {
        const { error } = await supabase.from('vistorias').upsert(payloads);
        if (error) throw error;

        // Marcar todos do lote como sincronizados
        lote.forEach(v => {
          markSincronizado(v.id);
          sucesso++;
        });
        logger.info('sync', `Lote sincronizado: ${lote.length} vistoria(s)`, {
          indices: `${i}–${i + lote.length - 1}`,
        });
      } catch (e: any) {
        // Lote falhou — tentar individualmente para isolar o registro problemático
        for (const vistoria of lote) {
          try {
            const { error: errSingle } = await supabase.from('vistorias').upsert(buildSupabasePayload(vistoria));
            if (errSingle) throw errSingle;
            markSincronizado(vistoria.id);
            sucesso++;
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

    if (sucesso > 0) {
      // VACUUM limitado a 1x/dia — evita travar SQLite a cada sync
      const vacuum = await shouldRunVacuum();
      if (vacuum) {
        try {
          getDb().runSync('VACUUM');
          await markVacuumRun();
          logger.info('sync', 'VACUUM executado');
        } catch { /* não crítico */ }
      }
      notificarSincronizacao(sucesso).catch(() => null);
      logger.info('sync', `Sync concluído — sucesso: ${sucesso}, falha: ${falha}`);
    } else if (falha > 0) {
      logger.warn('sync', `Sync concluído com falhas — sucesso: ${sucesso}, falha: ${falha}`);
    }
  } finally {
    _syncInProgress = false;
  }

  return { sucesso, falha };
}

/** Mapeia campos snake_case do SQLite para o schema camelCase do Supabase */
function buildSupabasePayload(v: VistoriaLocal): Record<string, any> {
  const fotosUrls = (() => {
    try { return v.fotos_urls ? JSON.parse(v.fotos_urls) : []; }
    catch { return []; }
  })();
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
    nivelRisco: v.nivel_risco,
    pontuacaoTotal: v.pontuacao_total,
    fotoUrl: v.foto_url,
    fotosUrls: fotosUrls,
    endereco: `${v.endereco_rua}, ${v.endereco_numero} - ${v.endereco_bairro}`,
  };
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
