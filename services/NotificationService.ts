import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../utils/supabase';
import { isLocalTestSession } from '../utils/localTestMode';
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

// ─── Channels Android criados na inicialização do módulo ─────────────────────
// Criados aqui (e não só dentro de requestNotificationPermissions) para garantir
// que existam antes de qualquer notificação ser agendada.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'TCS - Relatório de Risco',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#3B82F6',
    sound: 'default',
  });

  Notifications.setNotificationChannelAsync('alertas', {
    name: 'Alertas Críticos',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500],
    lightColor: '#EF4444',
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  Notifications.setNotificationChannelAsync('tokens', {
    name: 'Tokens de Acesso',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#8B5CF6',
    sound: 'default',
  });
}

// ─── Permissões ──────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// ─── Token Expo Push ──────────────────────────────────────────────────────────

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

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
    if (!session || isLocalTestSession(session)) return;

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
    trigger: null,
  });
}

export async function notificarDocumentoGerado(
  tipo: 'laudo' | 'relatorio' | 'termo',
  endereco: string,
): Promise<void> {
  const labels: Record<string, string> = {
    laudo: 'Laudo Técnico',
    relatorio: 'Relatório de Vistoria',
    termo: 'Termo de Interdição',
  };
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `📄 ${labels[tipo]} Gerado`,
      body: `Documento salvo — ${endereco || 'Local não informado'}`,
      data: { tipo: 'documento_gerado', tipoDoc: tipo },
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
    trigger: null,
  });
}

export async function notificarSincronizacao(count: number): Promise<void> {
  if (count === 0) return;
  let userName = '';
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    userName = (await AsyncStorage.getItem('@sync_user_name')) ?? '';
  } catch { /* não crítico */ }
  const prefix = userName ? `${userName}: ` : '';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '☁️ Sincronização Concluída',
      body: `${prefix}${count} vistoria${count !== 1 ? 's' : ''} sincronizada${count !== 1 ? 's' : ''} com sucesso.`,
      data: { tipo: 'sync' },
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
    trigger: null,
  });
}

export async function notificarSyncFalha(falhas: number, proxRetrySegundos: number): Promise<void> {
  if (falhas === 0) return;
  const tempoTexto = proxRetrySegundos >= 60
    ? `${Math.round(proxRetrySegundos / 60)} min`
    : `${proxRetrySegundos}s`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Sincronização Falhou',
      body: `${falhas} vistoria${falhas !== 1 ? 's' : ''} não sincronizada${falhas !== 1 ? 's' : ''}. Nova tentativa em ${tempoTexto}.`,
      data: { tipo: 'sync_falha', falhas },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      color: '#F59E0B',
      ...(Platform.OS === 'android' && { channelId: 'alertas' }),
    },
    trigger: null,
  });
}

export async function notificarSyncRetrying(tentativa: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔄 Tentando Sincronizar',
      body: `Tentativa ${tentativa} de re-sincronização em andamento...`,
      data: { tipo: 'sync_retry', tentativa },
      sound: undefined,
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
    trigger: null,
  });
}

export async function notificarSyncDesistiu(falhas: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '❌ Sincronização Falhou',
      body: `${falhas} vistoria${falhas !== 1 ? 's' : ''} não puderam ser enviada${falhas !== 1 ? 's' : ''}. Tente manualmente quando houver conexão estável.`,
      data: { tipo: 'sync_desistiu', falhas },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      color: '#EF4444',
      ...(Platform.OS === 'android' && { channelId: 'alertas' }),
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
      title: '🔔 Lembrete — TCS - Relatório de Risco',
      body: mensagem,
      data: { tipo: 'lembrete' },
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'default' }),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: segundos, repeats: false },
  });
}

// ─── Notificação: novo usuário aguardando aprovação ───────────────────────────
// Enviada via Expo Push API para o admin que criou o token.
// adminPushToken: token expo do admin (ExponentPushToken[...])
export async function notificarNovoUsuarioCadastrado(
  adminPushToken: string,
  nomeUsuario: string,
  municipio: string,
): Promise<void> {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: adminPushToken,
        title: '👤 Novo usuário cadastrado',
        body: `${nomeUsuario} entrou no sistema via token (${municipio}).`,
        data: { tipo: 'novo_usuario', municipio },
        sound: 'default',
        channelId: 'tokens',
        priority: 'high',
        ttl: 86400,
      }),
    });
    if (!res.ok) {
      logger.warn('notifications', 'Push novo usuário retornou erro HTTP', { status: res.status });
    }
  } catch (e) {
    logger.warn('notifications', 'Erro ao enviar push de novo usuário', { erro: String(e) });
  }
}

export async function notificarMasterSolicitaTokens(
  adminNome: string,
  municipio: string,
  usadoMes: number,
  limiteTotal: number,
): Promise<void> {
  try {
    const { data } = await supabase
      .from('users')
      .select('fcmToken')
      .eq('role', 'master_admin')
      .eq('isApproved', true)
      .not('fcmToken', 'is', null);

    if (!data || data.length === 0) return;

    const payloads = data
      .filter((u: any) => u.fcmToken)
      .map((u: any) => ({
        to: u.fcmToken,
        title: '📊 Solicitação de aumento de limite',
        body: `${adminNome} (${municipio}) usou ${usadoMes}/${limiteTotal} tokens e solicita aumento de limite.`,
        data: { tipo: 'solicita_tokens', municipio },
        sound: 'default',
        channelId: 'tokens',
        priority: 'high',
        ttl: 86400,
      }));

    if (payloads.length === 0) return;

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(payloads.length === 1 ? payloads[0] : payloads),
    });
    if (!res.ok) {
      logger.warn('notifications', 'Push solicitação de tokens retornou erro HTTP', { status: res.status });
    }
  } catch (e) {
    logger.warn('notifications', 'Erro ao notificar master sobre solicitação de tokens', { erro: String(e) });
  }
}

export async function notificarMasterTokenGerado(
  geradoPorNome: string,
  municipio: string,
  roleDestino: string,
): Promise<void> {
  try {
    // Buscar tokens push de todos os master_admins
    const { data } = await supabase
      .from('users')
      .select('fcmToken')
      .eq('role', 'master_admin')
      .eq('isApproved', true)
      .not('fcmToken', 'is', null);

    if (!data || data.length === 0) return;

    const roleLabels: Record<string, string> = {
      agent: 'Agente', supervisor: 'Supervisor', admin: 'Administrador',
    };

    const payloads = data
      .filter((u: any) => u.fcmToken)
      .map((u: any) => ({
        to: u.fcmToken,
        title: '🔑 Token de acesso gerado',
        body: `${geradoPorNome} gerou um convite de ${roleLabels[roleDestino] ?? roleDestino} em ${municipio}.`,
        data: { tipo: 'token_gerado', municipio },
        sound: 'default',
        channelId: 'tokens',
        priority: 'normal',
        ttl: 86400,
      }));

    if (payloads.length === 0) return;

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(payloads.length === 1 ? payloads[0] : payloads),
    });
    if (!res.ok) {
      logger.warn('notifications', 'Push token gerado retornou erro HTTP', { status: res.status });
    }
  } catch (e) {
    logger.warn('notifications', 'Erro ao notificar master sobre token', { erro: String(e) });
  }
}

// ─── Notificação: vistoria excluída pelo master_admin ─────────────────────────
// Enviada para o agente responsável + admins/supervisores do mesmo município.
export async function notificarVistoriaDeletada(
  agenteUid: string,
  agenteNome: string,
  municipio: string,
  endereco: string,
  motivo: string,
  masterNome: string,
): Promise<void> {
  try {
    // Buscar token do agente
    const [agentRes, staffRes] = await Promise.all([
      supabase
        .from('users')
        .select('fcmToken')
        .eq('uid', agenteUid)
        .not('fcmToken', 'is', null)
        .limit(1),
      supabase
        .from('users')
        .select('fcmToken')
        .eq('municipio', municipio)
        .in('role', ['admin', 'supervisor'])
        .eq('isApproved', true)
        .not('fcmToken', 'is', null),
    ]);

    const tokens: string[] = [];
    if (agentRes.data) agentRes.data.forEach((u: any) => u.fcmToken && tokens.push(u.fcmToken));
    if (staffRes.data)  staffRes.data.forEach((u: any) => u.fcmToken && tokens.push(u.fcmToken));

    const unique = [...new Set(tokens)];
    if (unique.length === 0) return;

    const enderecoShort = endereco.length > 50 ? endereco.slice(0, 47) + '…' : endereco;
    const payloads = unique.map(token => ({
      to: token,
      title: 'Vistoria excluída',
      body: `"${enderecoShort}" foi removida por ${masterNome}. Motivo: ${motivo}`,
      data: { tipo: 'vistoria_deletada', municipio, agenteNome },
      sound: 'default',
      channelId: 'alertas',
      priority: 'high',
      ttl: 86400,
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(payloads.length === 1 ? payloads[0] : payloads),
    });
    if (!res.ok) {
      logger.warn('notifications', 'Push exclusão de vistoria retornou erro HTTP', { status: res.status });
    }
  } catch (e) {
    logger.warn('notifications', 'Erro ao notificar exclusão de vistoria', { erro: String(e) });
  }
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
