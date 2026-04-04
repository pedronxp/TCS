import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
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

function PanelContent() {
  const { isLocked } = useSessionGuard();
  const { isOnlineReal } = useConnectivity();
  const prevConnected = useRef(false);

  useEffect(() => {
    registerBackgroundSync();
    startAppStateSyncListener();
    pingSupabaseKeepAlive().catch(() => null); // keep-alive Supabase free tier
    return () => stopAppStateSyncListener();
  }, []);

  useEffect(() => {
    if (isOnlineReal && !prevConnected.current) {
      logger.info('network', 'Conectividade restaurada — iniciando sync automático');
      syncPendentes().catch(() => null);
    } else if (!isOnlineReal && prevConnected.current) {
      logger.warn('network', 'Sem conexão com a internet — modo offline ativo');
    }
    prevConnected.current = isOnlineReal;
  }, [isOnlineReal]);

  if (isLocked) {
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
        <Stack.Screen name="inspecoes/[id]" />
        <Stack.Screen name="supervisor/index" />
        <Stack.Screen name="supervisor/equipe" />
        <Stack.Screen name="supervisor/agente" />
        <Stack.Screen name="supervisor/atribuicao" />
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
        <Stack.Screen name="master/index" />
        <Stack.Screen name="master/municipios" />
        <Stack.Screen name="master/logs" />
        <Stack.Screen name="modulos" />
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
