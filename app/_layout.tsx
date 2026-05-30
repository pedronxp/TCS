import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
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

// Silencia erros internos do Expo Go no Android
LogBox.ignoreLogs(['Unable to activate keep awake']);

// Ping leve ao Supabase no boot — mantém o projeto ativo no plano gratuito
async function pingSupabase() {
  try {
    await supabase.from('users').select('count').limit(1).maybeSingle();
  } catch { /* fire-and-forget */ }
}

async function requestPermissions() {
  try {
    await Location.requestForegroundPermissionsAsync();
  } catch { }
  try {
    await ImagePicker.requestCameraPermissionsAsync();
  } catch { }
  try {
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  } catch { }
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

  // Capturar chamadas de Deep Link com Token do Supabase (ex: Reset Password)
  useEffect(() => {
    const handleDeepLink = async (url: string | null) => {
      if (!url) return;
      if (url.includes('access_token=') && url.includes('refresh_token=')) {
        const accessTokenMatch = url.match(/access_token=([^&]*)/);
        const refreshTokenMatch = url.match(/refresh_token=([^&]*)/);
        if (accessTokenMatch && refreshTokenMatch) {
          await supabase.auth.setSession({
            access_token: accessTokenMatch[1],
            refresh_token: refreshTokenMatch[1],
          });
        }
      }
    };

    Linking.getInitialURL().then(handleDeepLink);
    const sub = Linking.addEventListener('url', (e) => handleDeepLink(e.url));
    return () => sub.remove();
  }, []);

  // Lê o flag do onboarding uma vez no mount + solicita permissões + keep-alive Supabase
  useEffect(() => {
    pingSupabase();
    AsyncStorage.getItem('@onboarding_done').then((val) => {
      setAppReady(true);
      // Solicita permissões apenas após o onboarding (não na primeira tela)
      if (val === '1') {
        requestPermissions();
      }
    });
  }, []);

  // Roteamento automático — lê AsyncStorage fresco a cada disparo para evitar
  // estado stale do onboardingDone quando o usuário acabou de concluir o onboarding
  useEffect(() => {
    if (loading || trainingLoading || !appReady) return;

    AsyncStorage.getItem('@onboarding_done').then(val => {
      const done = val === '1';
      const segs = segmentsRef.current;          // sempre atualizado via ref
      const inPanel = segs[0] === '(panel)';
      const inAuth = segs[0] === '(auth)';
      const inOnboarding = segs[0] === 'onboarding';
      const isAuthenticated = !!session && !!profile;
      const section = (segs as string[])[1];
      const inspectionRoute = (segs as string[])[2];
      const trainingAllowedInspectionRoutes = new Set([
        'dados-iniciais',
        'selecao-formulario',
        'wizard',
        'resultado',
        'relatorio',
      ]);
      const inTrainingAllowedPanel = inPanel && (
        section === 'treinamento'
        || (section === 'inspecoes' && trainingAllowedInspectionRoutes.has(inspectionRoute || ''))
      );
      const hasTrainingSession = !!trainingSession && isTrainingActive && !isExpired();

      // Fluxo de recuperação de senha: não redirecionar para dashboard mesmo com sessão temporária
      const inResetFlow = inAuth && ((segs as string[])[1] === 'verify-otp' || (segs as string[])[1] === 'reset-password');
      if (inResetFlow) return;

      if (!done && !inOnboarding) {
        router.replace('/onboarding');
        return;
      }

      if (trainingSession && isExpired()) {
        exit().catch(() => null);
        if (!inAuth) router.replace('/(auth)/treinamento');
        return;
      }

      if (isAuthenticated && !inPanel) {
        router.replace('/(panel)/dashboard');
      } else if (!isAuthenticated && hasTrainingSession && !inTrainingAllowedPanel) {
        router.replace('/(panel)/treinamento');
      } else if (!isAuthenticated && !inAuth && !inOnboarding) {
        router.replace('/(auth)');
      }
    });
  }, [session, profile, loading, trainingLoading, trainingSession, isTrainingActive, appReady, segmentsKey]);

  if (loading || trainingLoading || !appReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
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
          <TrainingProvider>
            <ReportProvider>
              <NotificationProvider>
                <ForceUpdateGate>
                  <RootNavigator />
                </ForceUpdateGate>
              </NotificationProvider>
            </ReportProvider>
          </TrainingProvider>
        </AuthProvider>
      </ThemeProvider>
    </ConnectivityProvider>
  );
}
