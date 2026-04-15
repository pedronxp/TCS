import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { supabase } from '../utils/supabase';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ConnectivityProvider, useConnectivity } from '../context/ConnectivityContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import { ReportProvider } from '../context/ReportContext';
import { ConnectivityBanner } from '../components/ConnectivityBanner';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Silencia erros internos do Expo Go no Android
LogBox.ignoreLogs(['Unable to activate keep awake']);

// Ping leve ao Supabase no boot - mantem o projeto ativo no plano gratuito
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

function OfflineAccessExpiredScreen({
  expiresAt,
  onRetry,
  onSignOut,
}: {
  expiresAt: string | null;
  onRetry: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const { theme } = useTheme();
  const { isOnlineReal } = useConnectivity();
  const [retrying, setRetrying] = useState(false);

  const expiresText = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const handleRetry = async () => {
    if (!isOnlineReal || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.background }}>
      <View
        style={{
          borderRadius: 24,
          padding: 24,
          backgroundColor: theme.surfaceHighlight,
          borderWidth: 1,
          borderColor: theme.border,
          gap: 16,
        }}
      >
        <View
          style={{
            width: 68,
            height: 68,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(245,158,11,0.12)',
          }}
        >
          <Text style={{ fontSize: 28 }}>{"\u23f3"}</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: '700' }}>
            Acesso offline expirado
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 15, lineHeight: 22 }}>
            Conecte-se a internet para validar sua sessao novamente antes de continuar usando o app.
          </Text>
          {expiresText ? (
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              Prazo encerrado em {expiresText}.
            </Text>
          ) : null}
        </View>

        <View
          style={{
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: isOnlineReal ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)',
            backgroundColor: isOnlineReal ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
          }}
        >
          <Text
            style={{
              color: isOnlineReal ? '#10B981' : '#F59E0B',
              fontSize: 13,
              fontWeight: '600',
            }}
          >
            {isOnlineReal
              ? 'Internet detectada. Voce ja pode validar o acesso.'
              : 'Sem internet no momento. Assim que a conexao voltar, valide o acesso.'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleRetry}
          disabled={!isOnlineReal || retrying}
          activeOpacity={0.85}
          style={{
            height: 54,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: !isOnlineReal || retrying ? theme.border : theme.primary,
          }}
        >
          {retrying ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>
              Validar acesso agora
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onSignOut}
          activeOpacity={0.8}
          style={{
            height: 50,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Text style={{ color: theme.textSecondary, fontSize: 15, fontWeight: '600' }}>
            Sair da sessao
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RootNavigator() {
  const {
    session,
    profile,
    loading,
    offlineAccessExpired,
    offlineAccessExpiresAt,
    retryAuthState,
    signOut,
  } = useAuth();
  const { isOnlineReal } = useConnectivity();
  const { lastResponse } = useNotifications();
  const segments = useSegments();
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);
  // Ref para segments - leitura sempre fresca dentro de efeitos async (sem loop)
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  // Navegacao ao tocar em notificacao
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

  // Le o flag do onboarding uma vez no mount + solicita permissoes + keep-alive Supabase
  useEffect(() => {
    pingSupabase();
    AsyncStorage.getItem('@onboarding_done').then((val) => {
      setAppReady(true);
      // Solicita permissoes apenas apos o onboarding (nao na primeira tela)
      if (val === '1') {
        requestPermissions();
      }
    });
  }, []);

  useEffect(() => {
    if (!offlineAccessExpired || !isOnlineReal) return;
    retryAuthState().catch(() => null);
  }, [offlineAccessExpired, isOnlineReal]);

  // Roteamento automatico - le AsyncStorage fresco a cada disparo para evitar
  // estado stale do onboardingDone quando o usuario acabou de concluir o onboarding
  useEffect(() => {
    if (loading || !appReady || offlineAccessExpired) return;

    AsyncStorage.getItem('@onboarding_done').then(val => {
      const done = val === '1';
      const segs = segmentsRef.current;
      const inPanel = segs[0] === '(panel)';
      const inAuth = segs[0] === '(auth)';
      const inOnboarding = segs[0] === 'onboarding';
      const isAuthenticated = !!session && !!profile;

      // Fluxo de recuperacao de senha: nao redirecionar para dashboard mesmo com sessao temporaria
      const inResetFlow = inAuth && ((segs as string[])[1] === 'verify-otp' || (segs as string[])[1] === 'reset-password');
      if (inResetFlow) return;

      if (!done && !inOnboarding) {
        router.replace('/onboarding');
        return;
      }

      if (isAuthenticated && !inPanel) {
        router.replace('/(panel)/dashboard');
      } else if (!isAuthenticated && !inAuth && !inOnboarding) {
        router.replace('/(auth)');
      }
    });
  }, [session, profile, loading, appReady, offlineAccessExpired]);

  if (loading || !appReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (offlineAccessExpired) {
    return (
      <>
        <StatusBar style="auto" translucent={false} />
        <OfflineAccessExpiredScreen
          expiresAt={offlineAccessExpiresAt}
          onRetry={retryAuthState}
          onSignOut={signOut}
        />
        <ConnectivityBanner />
      </>
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
    <SafeAreaProvider>
      <ConnectivityProvider>
        <ThemeProvider>
          <AuthProvider>
            <ReportProvider>
              <NotificationProvider>
                <RootNavigator />
              </NotificationProvider>
            </ReportProvider>
          </AuthProvider>
        </ThemeProvider>
      </ConnectivityProvider>
    </SafeAreaProvider>
  );
}
