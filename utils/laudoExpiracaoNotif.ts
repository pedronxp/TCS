import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from './database';

const LAST_DIGEST_KEY = 'tcs_last_laudo_digest_date';

/**
 * Verifica se há laudos expirando nas próximas 24h e agenda
 * uma notificação digest (máximo 1 por dia) para o agente.
 */
export async function verificarLaudosExpirando(): Promise<void> {
  try {
    // Guard: não rodar mais de uma vez por dia
    const hoje = new Date().toISOString().split('T')[0];
    const ultimoDigest = await AsyncStorage.getItem(LAST_DIGEST_KEY);
    if (ultimoDigest === hoje) return;

    const db = getDb();
    const agora = Date.now();
    const dia6ms = 6 * 24 * 60 * 60 * 1000;
    const dia7ms = 7 * 24 * 60 * 60 * 1000;

    const tsMin = Math.floor((agora - dia7ms) / 1000);
    const tsMax = Math.floor((agora - dia6ms) / 1000);

    // Laudos gerados há entre 6 e 7 dias
    const laudos = db.getAllSync<{ id: string }>(
      `SELECT id FROM vistorias_offline
       WHERE laudo_gerado_em IS NOT NULL
         AND CAST(strftime('%s', laudo_gerado_em) AS INTEGER) BETWEEN ? AND ?`,
      [tsMin, tsMax]
    );

    if (laudos.length === 0) return;

    const count = laudos.length;
    const titulo = count === 1 ? 'Laudo expira amanhã' : `${count} laudos expiram amanhã`;
    const corpo =
      count === 1
        ? 'Abra o app para regenerar o laudo antes que expire.'
        : `Você tem ${count} laudos que expiram em 24h. Abra o app para regenerá-los.`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: titulo,
        body: corpo,
        data: { tipo: 'laudo_expiracao' },
      },
      trigger: {
        hour: 9,
        minute: 0,
        repeats: false,
      } as any,
    });

    await AsyncStorage.setItem(LAST_DIGEST_KEY, hoje);
  } catch {
    // Silencioso — nunca crashar por causa de notificação
  }
}
