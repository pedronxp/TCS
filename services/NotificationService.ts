import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../utils/supabase';
import { logger } from '../utils/logger';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

if (Platform.OS === 'android') {
  void Notifications.setNotificationChannelAsync('default', { name: 'TCS - Relatório de Risco', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: '#3B82F6', sound: 'default' });
  void Notifications.setNotificationChannelAsync('alertas', { name: 'Alertas Críticos', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 500, 200, 500], lightColor: '#EF4444', sound: 'default', lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC });
  void Notifications.setNotificationChannelAsync('tokens', { name: 'Tokens de Acesso', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 100, 200], lightColor: '#8B5CF6', sound: 'default' });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;
  return (await Notifications.requestPermissionsAsync()).status === 'granted';
}

export async function hasNotificationPermission(): Promise<boolean> {
  return Device.isDevice && (await Notifications.getPermissionsAsync()).status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice || Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient') return null;
  try {
    const rawId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const projectId = rawId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId) ? rawId : undefined;
    return (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  } catch (error) {
    logger.warn('notifications', 'Erro ao obter push token', { erro: String(error) });
    return null;
  }
}

export async function registrarPushToken(): Promise<void> {
  try {
    if (!await requestNotificationPermissions()) return;
    const token = await getExpoPushToken();
    if (!token) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const platform = Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : 'unknown';
    const { error } = await supabase.rpc('register_my_notification_endpoint', {
      p_platform: platform,
      p_provider: 'expo',
      p_endpoint: token,
      p_subscription: null,
    });
    // The fallback preserves notifications while an older remote schema is
    // being upgraded. New installs use the multi-device endpoint registry.
    if (error) {
      const fallback = await supabase.rpc('update_my_push_token', { p_token: token });
      if (fallback.error) throw error;
    }
  } catch (error) {
    logger.warn('notifications', 'Erro ao registrar push token', { erro: String(error) });
  }
}

async function localNotification(title: string, body: string, data: Record<string, unknown>, channelId: 'default' | 'alertas' | 'tokens' = 'default', priority: Notifications.AndroidNotificationPriority = Notifications.AndroidNotificationPriority.DEFAULT, color?: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({ content: { title, body, data, sound: 'default', priority, color, ...(Platform.OS === 'android' && { channelId }) }, trigger: null });
}

export async function notificarVistoriaSalva(endereco: string, nivel: string): Promise<void> {
  const highRisk = ['r3', 'r4', 'alto'].includes(nivel);
  await localNotification(highRisk ? '⚠️ Vistoria de Alto Risco Salva' : '✅ Vistoria Salva', `${endereco || 'Local não informado'} — Risco: ${nivel.toUpperCase()}`, { tipo: 'vistoria_salva', nivel }, highRisk ? 'alertas' : 'default', highRisk ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.DEFAULT, highRisk ? '#EF4444' : '#10B981');
}

export async function notificarDocumentoGerado(tipo: 'laudo' | 'relatorio' | 'termo', endereco: string): Promise<void> {
  const labels = { laudo: 'Laudo Técnico', relatorio: 'Relatório de Vistoria', termo: 'Termo de Interdição' };
  await localNotification(`📄 ${labels[tipo]} Gerado`, `Documento salvo — ${endereco || 'Local não informado'}`, { tipo: 'documento_gerado', tipoDoc: tipo });
}

export async function notificarSincronizacao(count: number): Promise<void> {
  if (count > 0) await localNotification('☁️ Sincronização Concluída', `${count} vistoria${count === 1 ? '' : 's'} sincronizada${count === 1 ? '' : 's'} com sucesso.`, { tipo: 'sync' });
}

export async function notificarSyncFalha(falhas: number, proxRetrySegundos: number): Promise<void> {
  if (falhas === 0) return;
  const retry = proxRetrySegundos >= 60 ? `${Math.round(proxRetrySegundos / 60)} min` : `${proxRetrySegundos}s`;
  await localNotification('⚠️ Sincronização Falhou', `${falhas} vistoria${falhas === 1 ? '' : 's'} não sincronizada${falhas === 1 ? '' : 's'}. Nova tentativa em ${retry}.`, { tipo: 'sync_falha', falhas }, 'alertas', Notifications.AndroidNotificationPriority.HIGH, '#F59E0B');
}

export async function notificarSyncRetrying(tentativa: number): Promise<void> {
  await localNotification('🔄 Tentando Sincronizar', `Tentativa ${tentativa} de re-sincronização em andamento...`, { tipo: 'sync_retry', tentativa });
}

export async function notificarSyncDesistiu(falhas: number): Promise<void> {
  await localNotification('❌ Sincronização Falhou', `${falhas} vistoria${falhas === 1 ? '' : 's'} não puderam ser enviadas. Tente novamente quando houver conexão estável.`, { tipo: 'sync_desistiu', falhas }, 'alertas', Notifications.AndroidNotificationPriority.MAX, '#EF4444');
}

export async function notificarNovaAtribuicao(endereco: string, prioridade: string): Promise<void> {
  const urgent = ['alta', 'urgente'].includes(prioridade);
  await localNotification(urgent ? '🚨 Nova Missão URGENTE' : '📋 Nova Atribuição', `Vistoria solicitada em: ${endereco}`, { tipo: 'atribuicao', prioridade }, urgent ? 'alertas' : 'default', urgent ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.HIGH, urgent ? '#EF4444' : '#3B82F6');
}

export async function notificarLembrete(mensagem: string, segundos: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({ content: { title: '🔔 Lembrete — TCS - Relatório de Risco', body: mensagem, data: { tipo: 'lembrete' }, sound: 'default', ...(Platform.OS === 'android' && { channelId: 'default' }) }, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: segundos, repeats: false } });
}

// Eventos que exigem tokens ou dados de outros usuários são processados exclusivamente no servidor.
async function dispatchOperationalNotification(body: Record<string, string>): Promise<void> {
  const { error } = await supabase.functions.invoke('dispatch-operational-notification', { body });
  if (error) throw error;
}

export function notificarMasterSolicitaTokens(): Promise<void> {
  return dispatchOperationalNotification({ event: 'token_limit_request' });
}

export function notificarMasterTokenGerado(invitationCode: string): Promise<void> {
  return dispatchOperationalNotification({ event: 'token_generated', invitationCode });
}

export function excluirVistoriaComNotificacao(inspectionId: string, reason: string): Promise<void> {
  return dispatchOperationalNotification({ event: 'delete_inspection', inspectionId, reason });
}

export function addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(callback: (response: Notifications.NotificationResponse) => void): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function limparNotificacoes(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
}

export function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
