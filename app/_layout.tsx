import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { ThemeProvider } from '../context/ThemeContext';
import { ConnectivityProvider } from '../context/ConnectivityContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import { ReportProvider } from '../context/ReportContext';
import { ConnectivityBanner } from '../components/ConnectivityBanner';

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
  const { lastResponse } = useNotifications();
  const segments = useSegments();
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);
  // Ref para segments — leitura sempre fresca dentro de efeitos async (sem loop)
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  // Navegação ao tocar em notificação
  useEffect(() => {
    if (!lastResponse) return;
    const data = lastResponse.notification.request.content.data as Record<string, any>;
    if (data?.tipo === 'atribuicao' || data?.tipo === 'vistoria_salva' || data?.tipo === 'sync') {
      router.push('/(panel)/inspecoes');
    }
  }, [lastResponse]);

  // Lê o flag do onboarding uma vez no mount + solicita permissões
  useEffect(() => {
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
    if (loading || !appReady) return;

    AsyncStorage.getItem('@onboarding_done').then(val => {
      const done = val === '1';
      const segs = segmentsRef.current;          // sempre atualizado via ref
      const inPanel = segs[0] === '(panel)';
      const inAuth = segs[0] === '(auth)';
      const inOnboarding = segs[0] === 'onboarding';
      const isAuthenticated = !!session && !!profile;

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
  }, [session, profile, loading, appReady]);

  if (loading || !appReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <>
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
          <ReportProvider>
            <NotificationProvider>
              <RootNavigator />
            </NotificationProvider>
          </ReportProvider>
        </AuthProvider>
      </ThemeProvider>
    </ConnectivityProvider>
  );
}
