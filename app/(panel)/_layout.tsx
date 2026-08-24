import { Stack, useSegments, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useConnectivity } from '../../context/ConnectivityContext';
import {
  syncPendentes,
  registerBackgroundSync,
  startAppStateSyncListener,
  stopAppStateSyncListener,
} from '../../services/SyncService';
import { logger } from '../../utils/logger';
import { BottomNavBar } from '../../components/BottomNavBar';
import { SessionGuardProvider, useSessionGuard } from '../../context/SessionGuardContext';
import { SessionLockScreen } from '../../components/SessionLockScreen';
import { pingSupabaseKeepAlive } from '../../services/KeepAliveService';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { useTraining } from '../../context/TrainingContext';

// Rotas que exigem papel mínimo para acesso.
// Qualquer rota não listada aqui é acessível a qualquer usuário autenticado.
const ROUTE_ROLES: Record<string, readonly string[]> = {
  'admin':        ['admin', 'master_admin'],
  'supervisor':   ['supervisor', 'admin', 'master_admin'],
  'master':       ['master_admin'],
  'internal':     ['owner', 'developer', 'support', 'auditor'],
};

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
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading || !profile) return;

    // segments[0] = "(panel)", segments[1] = section (admin/supervisor/master/...)
    const section = segments[1] as string | undefined;
    if (!section) return;

    const nestedRoute = `${section}/${segments[2] || ''}`;
    if (WEB_ONLY_ROUTES.has(nestedRoute)) {
      logger.info('auth', `Ação administrativa disponível apenas no painel web: ${nestedRoute}`);
      router.replace('/(panel)/modulos');
      return;
    }

    const allowed = ROUTE_ROLES[section];
    if (!allowed) return; // Rota sem restrição de papel

    if (!allowed.includes(profile.role)) {
      logger.warn('auth', `Acesso negado à seção "${section}" para papel "${profile.role}" — redirecionando`);
      // Redireciona para dashboard sem permissão de navegar de volta
      router.replace('/(panel)/dashboard');
    }
  }, [segments, profile, loading]);
}

function PanelContent() {
  const { isLocked, ready } = useSessionGuard();
  const { refreshProfile } = useAuth();
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

  if (!ready && !isolatedMode) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  if (isLocked && !isolatedMode) {
    return <SessionLockScreen />;
  }

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
        <Stack.Screen name="planos" />
        <Stack.Screen name="coordenacao" />
        <Stack.Screen name="suporte" />
      </Stack>
      <BottomNavBar />
    </View>
  );
}

export default function PanelLayout() {
  return (
    <SessionGuardProvider>
      <PanelContent />
    </SessionGuardProvider>
  );
}
