import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../utils/supabase';
import { logger } from '../utils/logger';

// Configuração do handler de notificações (deve ficar no topo do módulo)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Permissões ──────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    // Simulador/emulador — notificações não funcionam
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Defesa Civil',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('alertas', {
      name: 'Alertas Críticos',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#EF4444',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  return finalStatus === 'granted';
}

// ─── Token Expo Push ──────────────────────────────────────────────────────────

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  // Expo Go SDK 53+ removeu push remoto — só funciona em APK/dev build
  if (Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient') {
    return null;
  }

  try {
    const rawId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const projectId = rawId && UUID_REGEX.test(rawId) ? rawId : undefined;

    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    return tokenData.data;
  } catch (e) {
    logger.warn('notifications', 'Erro ao obter push token', { erro: String(e) });
    return null;
  }
}

// ─── Registrar token no Supabase ─────────────────────────────────────────────

export async function registrarPushToken(): Promise<void> {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    const token = await getExpoPushToken();
    if (!token) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase
      .from('users')
      .update({ fcmToken: token })
      .eq('uid', session.user.id);
  } catch (e) {
    logger.warn('notifications', 'Erro ao registrar push token', { erro: String(e) });
  }
}

// ─── Notificações Locais ──────────────────────────────────────────────────────

export async function notificarVistoriaSalva(endereco: string, nivel: string): Promise<void> {
  const isAlto = nivel === 'r3' || nivel === 'r4' || nivel === 'alto';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: isAlto ? '⚠️ Vistoria de Alto Risco Salva' : '✅ Vistoria Salva',
      body: `${endereco || 'Local não informado'} — Risco: ${nivel?.toUpperCase()}`,
      data: { tipo: 'vistoria_salva', nivel },
      sound: 'default',
      priority: isAlto
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.DEFAULT,
      color: isAlto ? '#EF4444' : '#10B981',
      ...(Platform.OS === 'android' && { channelId: isAlto ? 'alertas' : 'default' }),
    },
    trigger: null, // imediata
  });
}

export async function notificarSincronizacao(count: number): Promise<void> {
  if (count === 0) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '☁️ Sincronização Concluída',
      body: `${count} vistoria${count !== 1 ? 's' : ''} sincronizada${count !== 1 ? 's' : ''} com sucesso.`,
      data: { tipo: 'sync' },
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
    trigger: null,
  });
}

export async function notificarNovaAtribuicao(endereco: string, prioridade: string): Promise<void> {
  const isUrgente = prioridade === 'alta' || prioridade === 'urgente';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: isUrgente ? '🚨 Nova Missão URGENTE' : '📋 Nova Atribuição',
      body: `Vistoria solicitada em: ${endereco}`,
      data: { tipo: 'atribuicao', prioridade },
      sound: 'default',
      priority: isUrgente
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
      color: isUrgente ? '#EF4444' : '#3B82F6',
      ...(Platform.OS === 'android' && { channelId: isUrgente ? 'alertas' : 'default' }),
    },
    trigger: null,
  });
}

export async function notificarLembrete(mensagem: string, segundos: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Lembrete — Defesa Civil',
      body: mensagem,
      data: { tipo: 'lembrete' },
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: segundos, repeats: false },
  });
}

// ─── Listeners ────────────────────────────────────────────────────────────────

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

export async function limparNotificacoes(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
}

export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
