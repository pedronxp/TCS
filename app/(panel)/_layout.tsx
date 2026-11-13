import { Stack, useGlobalSearchParams, useSegments, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { watchInspectionReviewNotifications } from '../../services/NotificationService';
import { AppState, Modal, ScrollView, View } from 'react-native';
import { useConnectivity } from '../../context/ConnectivityContext';
import {
  syncPendentes,
  registerBackgroundSync,
  startAppStateSyncListener,
  stopAppStateSyncListener,
} from '../../services/SyncService';
import { logger } from '../../utils/logger';
import { BottomNavBar } from '../../components/BottomNavBar';
import { pingSupabaseKeepAlive } from '../../services/KeepAliveService';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { useTraining } from '../../context/TrainingContext';
import { canAccessMobileFieldOperation } from '../../services/MobileAccessService';
import { canAccessPanelRoute } from '../../services/OwnerExperienceService';
import { OwnerExperienceProvider, useOwnerExperience } from '../../context/OwnerExperienceContext';
import { OwnerExperienceChoice } from '../../components/OwnerExperienceChoice';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

const WEB_ONLY_ROUTES = new Set([
  'master/contratacoes',
  'master/municipios',
  'master/logs',
  'admin/form-editor',
  'admin/editor-perguntas',
  'admin/risco-config',
  'admin/tokens',
  'admin/gerar-token',
]);

function useRouteGuard() {
  const segments = useSegments() as string[];
  const { teste } = useGlobalSearchParams<{ teste?: string }>();
  const { profile, loading } = useAuth();
  const { context: subscriptionContext, loading: subscriptionLoading, error: subscriptionError, hasFeature } = useSubscription();

  useEffect(() => {
    if (loading || !profile) return;

    // segments[0] = "(panel)", segments[1] = section (admin/supervisor/master/...)
    const section = segments[1] as string | undefined;
    if (!section) return;
    const localInspectionTest = section === 'inspecoes'
      && teste === '1'
      && ['owner', 'support', 'developer'].includes(profile.role)
      && ['selecao-formulario', 'wizard', 'resultado'].includes(segments[2]);
    if (localInspectionTest) return;

    // ── Bloqueio por suspensão de cobrança (F3) ──
    // Org/assinatura suspensa → só acessa cobrança, suporte e dashboard.
    const suspensa =
      subscriptionContext?.organization?.status === 'suspended' ||
      subscriptionContext?.subscription?.status === 'suspended';
    if (suspensa) {
      const permitidas = ['assinatura', 'suporte', 'dashboard'];
      if (!permitidas.includes(section)) {
        logger.warn('auth', `Acesso bloqueado (suspensão): seção "${section}"`);
        router.replace('/(panel)/assinatura');
        return;
      }
    }

    if (section === 'inspecoes'
      && !canAccessMobileFieldOperation(profile.role, profile.permissions, 'inspections')) {
      logger.warn('auth', 'Acesso de campo negado para perfil interno sem permissão de vistoria');
      router.replace('/(panel)/internal');
      return;
    }

    if (section === 'mapas'
      && !canAccessMobileFieldOperation(profile.role, profile.permissions, 'tactical-map')) {
      logger.warn('auth', 'Acesso de mapa negado para perfil interno sem permissão de mapa');
      router.replace('/(panel)/internal');
      return;
    }

    const nestedRoute = `${section}/${segments[2] || ''}`;
    if (WEB_ONLY_ROUTES.has(nestedRoute) && profile.role !== 'owner') {
      logger.info('auth', `Ação administrativa disponível apenas no painel web: ${nestedRoute}`);
      router.replace('/(panel)/modulos');
      return;
    }

    const operationalReports = nestedRoute === 'admin/relatorios' && ['agent', 'supervisor'].includes(profile.role);
    if (operationalReports && (subscriptionLoading || (!subscriptionContext && !subscriptionError))) return;
    const reportsAllowed = Boolean(subscriptionContext) && ['reports_basic', 'reports_advanced', 'reports_institutional'].some(hasFeature);
    if (!canAccessPanelRoute(profile.role, nestedRoute, reportsAllowed)) {
      logger.warn('auth', `Acesso negado à seção "${section}" para papel "${profile.role}" — redirecionando`);
      // Redireciona para dashboard sem permissão de navegar de volta
      router.replace('/(panel)/dashboard');
    }
  }, [segments, teste, profile, loading, subscriptionContext, subscriptionLoading, subscriptionError, hasFeature]);
}

function PanelContent() {
  const { refreshProfile, profile } = useAuth();
  const userId = profile?.uid;
  useEffect(() => userId ? watchInspectionReviewNotifications(userId) : undefined, [userId]);
  const { mode, loading: modeLoading, error: modeError } = useOwnerExperience();
  const { theme } = useTheme();
  const { refresh: refreshSubscription } = useSubscription();
  const { isOnlineReal } = useConnectivity();
  const { isTrainingActive } = useTraining();
  const isolatedMode = isTrainingActive;
  const prevConnected = useRef(false);

  // Guarda de rota por papel — executado a cada mudança de segmento
  useRouteGuard();

  useEffect(() => {
    if (isolatedMode) return;
    registerBackgroundSync();
    startAppStateSyncListener();
    pingSupabaseKeepAlive().catch(() => null); // keep-alive Supabase free tier
    return () => stopAppStateSyncListener();
  }, [isolatedMode]);

  useEffect(() => {
    if (isolatedMode) return;
    if (isOnlineReal && !prevConnected.current) {
      logger.info('network', 'Conectividade restaurada — iniciando sync automático');
      syncPendentes().catch(() => null);
      refreshProfile().catch(() => null);
      refreshSubscription().catch(() => null);
    } else if (!isOnlineReal && prevConnected.current) {
      logger.warn('network', 'Sem conexão com a internet — modo offline ativo');
    }
    prevConnected.current = isOnlineReal;
  }, [isOnlineReal, isolatedMode, refreshProfile, refreshSubscription]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const returningToForeground = previousState !== 'active' && nextState === 'active';
      previousState = nextState;
      if (returningToForeground && !isolatedMode) {
        void refreshProfile();
        void refreshSubscription();
      }
    });
    return () => subscription.remove();
  }, [isolatedMode, refreshProfile, refreshSubscription]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="perfil" />
        <Stack.Screen name="mapas" />
        <Stack.Screen name="inspecoes/index" />
        <Stack.Screen name="inspecoes/dados-iniciais" />
        <Stack.Screen name="inspecoes/selecao-formulario" />
        <Stack.Screen name="inspecoes/wizard" />
        <Stack.Screen name="inspecoes/risco" />
        <Stack.Screen name="inspecoes/resultado" />
        <Stack.Screen name="inspecoes/relatorio" />
        <Stack.Screen name="inspecoes/foto" />
        <Stack.Screen name="inspecoes/ciencia" />
        <Stack.Screen name="inspecoes/[id]" />
        <Stack.Screen name="supervisor/index" />
        <Stack.Screen name="admin/index" />
        <Stack.Screen name="admin/usuarios" />
        <Stack.Screen name="admin/tokens" />
        <Stack.Screen name="admin/gerar-token" />
        <Stack.Screen name="admin/estatisticas" />
        <Stack.Screen name="admin/relatorios" />
        <Stack.Screen name="admin/form-editor" />
        <Stack.Screen name="admin/risco-config" />
        <Stack.Screen name="admin/logs" />
        <Stack.Screen name="admin/protocolo-doc" />
        <Stack.Screen name="admin/personalizar-dashboard" />
        <Stack.Screen name="admin/editor-perguntas" />
        <Stack.Screen name="inspecoes/laudo" />
        <Stack.Screen name="treinamento/index" />
        <Stack.Screen name="treinamento/acesso" />
        <Stack.Screen name="master/index" />
        <Stack.Screen name="master/municipios" />
        <Stack.Screen name="master/treinamentos" />
        <Stack.Screen name="master/logs" />
        <Stack.Screen name="master/contratacoes" />
        <Stack.Screen name="internal/index" />
        <Stack.Screen name="modulos" />
        <Stack.Screen name="avisos/index" />
        <Stack.Screen name="assinatura" />
        <Stack.Screen name="qe/index" />
        <Stack.Screen name="qe/[id]" />
        <Stack.Screen name="planos" />
        <Stack.Screen name="coordenacao" />
        <Stack.Screen name="suporte" />
        <Stack.Screen name="suporte/[id]" />
      </Stack>
      <BottomNavBar />
      <Modal visible={profile?.role === 'owner' && !modeLoading && !mode && !modeError} animationType="slide" onRequestClose={() => {}}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}><ScrollView><OwnerExperienceChoice /></ScrollView></SafeAreaView>
      </Modal>
    </View>
  );
}

export default function PanelLayout() {
  return <OwnerExperienceProvider><PanelContent /></OwnerExperienceProvider>;
}
