import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { supabase } from '../utils/supabase';
import { ThemeProvider } from '../context/ThemeContext';
import { ConnectivityProvider } from '../context/ConnectivityContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { TrainingProvider, useTraining } from '../context/TrainingContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import { ReportProvider } from '../context/ReportContext';
import { ConnectivityBanner } from '../components/ConnectivityBanner';
import { ForceUpdateGate } from '../components/ForceUpdateGate';
import { LogBox } from 'react-native';
import { resolveRootRedirect } from '../utils/rootRouting';
import { SubscriptionProvider } from '../context/SubscriptionContext';
import { SessionLifecycle } from '../services/SessionService';
import { OpeningBoot } from '../components/brand';
import {
  completeCustomerAuthCallback,
  markPasswordRecoverySession,
} from '../services/CustomerAuthService';

// Silencia erros internos do Expo Go no Android
LogBox.ignoreLogs(['Unable to activate keep awake']);

// Ping leve ao Supabase no boot — mantém o projeto ativo no plano gratuito
async function pingSupabase() {
  try {
    await supabase.from('users').select('count').limit(1).maybeSingle();
  } catch { /* fire-and-forget */ }
}

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const { session: trainingSession, loading: trainingLoading, isTrainingActive, isExpired, exit } = useTraining();
  const { lastResponse } = useNotifications();
  const segments = useSegments();
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);
  // Ref para segments — leitura sempre fresca dentro de efeitos async (sem loop)
  const segmentsRef = useRef(segments);
  const processedAuthCallbacks = useRef(new Set<string>());
  segmentsRef.current = segments;
  const segmentsKey = segments.join('/');

  // Navegação ao tocar em notificação
  useEffect(() => {
    if (!lastResponse) return;
    const data = lastResponse.notification.request.content.data as Record<string, any>;
    if (data?.tipo === 'atribuicao' || data?.tipo === 'vistoria_salva' || data?.tipo === 'sync') {
      router.push('/(panel)/inspecoes');
    }
  }, [lastResponse]);

  // Troca callback PKCE uma vez e mantém recuperação separada do login comum.
  useEffect(() => {
    const handleDeepLink = async (url: string | null) => {
      if (!url || processedAuthCallbacks.current.has(url)) return;
      if (!url.includes('auth/callback') && !url.includes('auth/reset-password')) return;
      processedAuthCallbacks.current.add(url);
      try {
        const result = await completeCustomerAuthCallback(url);
        if (result.recovery && result.session) {
          router.replace('/(auth)/reset-password');
        }
      } catch {
        // Código expirado/reutilizado não cria sessão nem nova identidade.
      }
    };

    Linking.getInitialURL().then(handleDeepLink);
    const sub = Linking.addEventListener('url', (e) => handleDeepLink(e.url));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, recoverySession) => {
        if (event === 'PASSWORD_RECOVERY' && recoverySession) {
          await markPasswordRecoverySession(recoverySession);
          router.replace('/(auth)/reset-password');
        }
      },
    );
    return () => {
      sub.remove();
      subscription.unsubscribe();
    };
  }, [router]);

  // Lê o flag de apresentação uma vez no mount. Câmera e localização são
  // solicitadas somente na funcionalidade que realmente precisa delas.
  useEffect(() => {
    pingSupabase();
    AsyncStorage.getItem('@onboarding_done').then(() => {
      setAppReady(true);
    });
  }, []);

  // Roteamento automático — lê AsyncStorage fresco a cada disparo para evitar
  // estado stale do onboardingDone quando o usuário acabou de concluir o onboarding
  useEffect(() => {
    if (loading || trainingLoading || !appReady) return;

    AsyncStorage.getItem('@onboarding_done').then(val => {
      const done = val === '1';
      const segs = segmentsRef.current;          // sempre atualizado via ref
      const isAuthenticated = !!session && profile?.isApproved === true;
      const hasPendingCustomerSession = !!session && profile?.isApproved !== true;
      const hasExpiredTrainingSession = !!trainingSession && isExpired();
      const hasTrainingSession = !!trainingSession && isTrainingActive && !hasExpiredTrainingSession;
      const redirect = resolveRootRedirect({
        segments: segs as string[],
        onboardingDone: done,
        isAuthenticated,
        hasPendingCustomerSession,
        hasTrainingSession,
        hasExpiredTrainingSession,
      });

      // Encerra cache local se a sessao de treinamento expirou.
      if (hasExpiredTrainingSession) {
        exit().catch(() => null);
      }

      if (redirect) router.replace(redirect);
    });
  }, [session, profile, loading, trainingLoading, trainingSession, isTrainingActive, appReady, segmentsKey, isExpired, exit]);

  if (loading || trainingLoading || !appReady) {
    return <OpeningBoot />;
  }

  return (
    <>
      <StatusBar style="auto" translucent={false} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(panel)" />
      </Stack>
      <ConnectivityBanner />
    </>
  );
}

export default function RootLayout() {
  return (
    <ConnectivityProvider>
      <ThemeProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <SessionLifecycle />
            <TrainingProvider>
              <ReportProvider>
                <NotificationProvider>
                  <ForceUpdateGate>
                    <RootNavigator />
                  </ForceUpdateGate>
                </NotificationProvider>
              </ReportProvider>
            </TrainingProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </ConnectivityProvider>
  );
}
