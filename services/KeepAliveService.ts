import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { logger } from '../utils/logger';

const KEEP_ALIVE_KEY = '@supabase_keep_alive_last';
// Supabase pausa após 7 dias sem uso — pingar a cada 4 dias
const INTERVAL_MS = 4 * 24 * 60 * 60 * 1000;

/**
 * Faz um ping mínimo ao Supabase para evitar que o projeto
 * adormeça no plano free por inatividade.
 * Roda no máximo 1x a cada 4 dias.
 * Chame no mount do layout principal.
 */
export async function pingSupabaseKeepAlive(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEEP_ALIVE_KEY);
    if (raw) {
      const last = parseInt(raw, 10);
      if (Date.now() - last < INTERVAL_MS) return;
    }
    // Query mínima — apenas acorda o banco, não retorna dados sensíveis
    await supabase.from('users').select('uid').limit(1);
    await AsyncStorage.setItem(KEEP_ALIVE_KEY, String(Date.now()));
    logger.info('keepalive', 'Ping Supabase realizado — banco mantido ativo');
  } catch {
    // Não crítico — falha silenciosa
  }
}
