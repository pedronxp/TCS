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

export default function PanelLayout() {
  const { isOnlineReal } = useConnectivity();

  // Inicializar como false para garantir sync imediato no mount quando já conectado.
  // Se isOnlineReal=true na primeira renderização, dispara syncPendentes() imediatamente.
  // O guard _syncInProgress em SyncService.ts garante idempotência se AppState também disparar.
  const prevConnected = useRef(false);

  useEffect(() => {
    // Registrar background task e listener de AppState ao entrar no painel
    registerBackgroundSync();
    startAppStateSyncListener();

    return () => stopAppStateSyncListener();
  }, []);

  useEffect(() => {
    // Disparar sync imediato ao voltar online (verificação real, não só interface)
    if (isOnlineReal && !prevConnected.current) {
      logger.info('network', 'Conectividade restaurada — iniciando sync automático');
      syncPendentes().catch(() => null);
    } else if (!isOnlineReal && prevConnected.current) {
      logger.warn('network', 'Sem conexão com a internet — modo offline ativo');
    }
    prevConnected.current = isOnlineReal;
  }, [isOnlineReal]);

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
