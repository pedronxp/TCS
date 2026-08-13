import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { logger } from '../utils/logger';
import {
  hasNotificationPermission,
  registrarPushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  notificarVistoriaSalva,
  notificarSincronizacao,
  notificarNovaAtribuicao,
  notificarLembrete,
  limparNotificacoes,
  getBadgeCount,
  setBadgeCount,
} from '../services/NotificationService';

interface NotificationContextValue {
  hasPermission: boolean;
  badgeCount: number;
  lastResponse: Notifications.NotificationResponse | null;
  notificarVistoriaSalva: (endereco: string, nivel: string) => Promise<void>;
  notificarSincronizacao: (count: number) => Promise<void>;
  notificarNovaAtribuicao: (endereco: string, prioridade: string) => Promise<void>;
  notificarLembrete: (mensagem: string, segundos: number) => Promise<void>;
  limparNotificacoes: () => Promise<void>;
  atualizarBadge: (count: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [hasPermission, setHasPermission] = useState(false);
  const [badgeCount, setBadgeState] = useState(0);
  const [lastResponse, setLastResponse] = useState<Notifications.NotificationResponse | null>(null);
  const receivedRef = useRef<Notifications.EventSubscription | null>(null);
  const responseRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // No boot apenas observa a permissão existente. A solicitação deve partir
    // de uma ação contextual do usuário, nunca do cadastro ou da abertura.
    hasNotificationPermission().then(granted => {
      setHasPermission(granted);
      if (granted) {
        registrarPushToken();
        getBadgeCount().then(setBadgeState);
      }
    });

    // Listener: notificação recebida com app em foreground
    receivedRef.current = addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as Record<string, any>;
      logger.info('system', 'Notificação recebida', { tipo: data?.tipo });
    });

    // Listener: usuário tocou — armazena resposta para RootNavigator navegar
    responseRef.current = addNotificationResponseListener(response => {
      setLastResponse(response);
    });

    return () => {
      receivedRef.current?.remove();
      responseRef.current?.remove();
    };
  }, []);

  const atualizarBadge = async (count: number) => {
    await setBadgeCount(count);
    setBadgeState(count);
  };

  const value: NotificationContextValue = {
    hasPermission,
    badgeCount,
    lastResponse,
    notificarVistoriaSalva,
    notificarSincronizacao,
    notificarNovaAtribuicao,
    notificarLembrete,
    limparNotificacoes,
    atualizarBadge,
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
