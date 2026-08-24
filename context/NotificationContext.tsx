import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';
import {
  hasNotificationPermission,
  requestNotificationPermissions,
  registrarPushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  notificarVistoriaSalva,
  notificarSincronizacao,
  notificarNovaAtribuicao,
  notificarLembrete,
  limparNotificacoes as limparNotificacoesDoAparelho,
  getBadgeCount,
  setBadgeCount,
} from '../services/NotificationService';

interface NotificationContextValue {
  hasPermission: boolean;
  pushSupported: boolean;
  badgeCount: number;
  lastResponse: Notifications.NotificationResponse | null;
  notificarVistoriaSalva: (endereco: string, nivel: string) => Promise<void>;
  notificarSincronizacao: (count: number) => Promise<void>;
  notificarNovaAtribuicao: (endereco: string, prioridade: string) => Promise<void>;
  notificarLembrete: (mensagem: string, segundos: number) => Promise<void>;
  limparNotificacoes: () => Promise<void>;
  atualizarBadge: (count: number) => Promise<void>;
  solicitarPermissao: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);
  const [badgeCount, setBadgeState] = useState(0);
  const [lastResponse, setLastResponse] = useState<Notifications.NotificationResponse | null>(null);
  const receivedRef = useRef<Notifications.EventSubscription | null>(null);
  const responseRef = useRef<Notifications.EventSubscription | null>(null);
  const pushSupported = Boolean(
    Device.isDevice
    && Constants.appOwnership !== 'expo'
    && Constants.executionEnvironment !== 'storeClient'
  );

  useEffect(() => {
    // No boot apenas observa a permissão existente. A solicitação deve partir
    // de uma ação contextual do usuário, nunca do cadastro ou da abertura.
    let active = true;
    hasNotificationPermission()
      .then(granted => {
        if (!active) return;
        setHasPermission(granted);
        if (granted) {
          void getBadgeCount()
            .then(count => {
              if (active) setBadgeState(count);
            })
            .catch(() => null);
        }
      })
      .catch(error => {
        logger.warn('notifications', 'Não foi possível verificar a permissão de notificações', { erro: String(error) });
      });

    // Listener: notificação recebida com app em foreground
    receivedRef.current = addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as Record<string, any>;
      logger.info('system', 'Notificação recebida', { tipo: data?.tipo });
      if (data?.tipo === 'comunicado' || data?.tipo === 'aviso' || data?.tipo === 'emergencia') {
        setBadgeState((current) => current + 1);
      }
    });

    // Listener: usuário tocou — armazena resposta para RootNavigator navegar
    responseRef.current = addNotificationResponseListener(response => {
      setLastResponse(response);
    });

    return () => {
      active = false;
      receivedRef.current?.remove();
      responseRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!profile?.uid) {
      setBadgeState(0);
      setLastResponse(null);
      return;
    }
    if (!hasPermission || !pushSupported) return;
    registrarPushToken().catch(() => null);
  }, [hasPermission, profile?.uid, pushSupported]);

  const atualizarBadge = useCallback(async (count: number) => {
    const nextCount = Math.max(0, Math.trunc(count));
    setBadgeState(nextCount);
    try {
      await setBadgeCount(nextCount);
    } catch (error) {
      logger.warn('notifications', 'Não foi possível atualizar o badge do sistema', { erro: String(error) });
    }
  }, []);

  const solicitarPermissao = useCallback(async () => {
    const granted = await requestNotificationPermissions();
    setHasPermission(granted);
    if (granted && profile?.uid && pushSupported) {
      await registrarPushToken();
    }
    return granted;
  }, [profile?.uid, pushSupported]);

  const limparNotificacoes = useCallback(async () => {
    await limparNotificacoesDoAparelho();
    setBadgeState(0);
  }, []);

  const value: NotificationContextValue = {
    hasPermission,
    pushSupported,
    badgeCount,
    lastResponse,
    notificarVistoriaSalva,
    notificarSincronizacao,
    notificarNovaAtribuicao,
    notificarLembrete,
    limparNotificacoes,
    atualizarBadge,
    solicitarPermissao,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
