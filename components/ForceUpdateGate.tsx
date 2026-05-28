import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { AppUpdateConfig, AppUpdateDecision } from '../utils/appUpdate';
import {
  checkAndroidAppUpdate,
  getInstalledAppVersion,
  hasAvailableUpdate,
  shouldForceUpdate,
} from '../utils/appUpdate';

const UPDATE_CACHE_KEY = '@app_update_config_android_v1';
const UPDATE_CHECK_TIMEOUT_MS = 6000;

type GateState =
  | { status: 'checking' }
  | { status: 'allowed' }
  | { status: 'blocked'; decision: AppUpdateDecision; source: 'remote' | 'cache' };

export function ForceUpdateGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ status: 'checking' });
  const [opening, setOpening] = useState(false);

  const runCheck = async () => {
    setState({ status: 'checking' });
    try {
      const decision = await withTimeout(checkAndroidAppUpdate(), UPDATE_CHECK_TIMEOUT_MS);
      if (decision.config) {
        await AsyncStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify(decision.config));
      }
      setState(decision.mustUpdate ? { status: 'blocked', decision, source: 'remote' } : { status: 'allowed' });
    } catch {
      const cached = await readCachedDecision();
      setState(cached ? { status: 'blocked', decision: cached, source: 'cache' } : { status: 'allowed' });
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', status => {
      if (status === 'active') runCheck();
    });
    return () => sub.remove();
  }, []);

  const openUpdate = async () => {
    if (state.status !== 'blocked' || !state.decision.config?.apkUrl) return;
    setOpening(true);
    try {
      await Linking.openURL(state.decision.config.apkUrl);
    } finally {
      setOpening(false);
    }
  };

  if (state.status === 'checking') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (state.status === 'blocked') {
    const { installed, config } = state.decision;
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Feather name="download-cloud" size={34} color="#FFFFFF" />
          </View>

          <Text style={styles.title}>Atualização obrigatória</Text>
          <Text style={styles.message}>
            {config?.message || 'Existe uma nova versão do aplicativo. Atualize para continuar usando o sistema.'}
          </Text>

          <View style={styles.versionBox}>
            <Text style={styles.versionLabel}>Versão instalada</Text>
            <Text style={styles.versionValue}>{installed.version} · build {installed.versionCode}</Text>
            <Text style={styles.versionLabel}>Versão exigida</Text>
            <Text style={styles.versionValue}>{config?.latestVersion || '—'} · build {config?.minRequiredVersionCode ?? '—'}</Text>
          </View>

          {config?.apkUrl ? (
            <TouchableOpacity style={styles.primaryButton} onPress={openUpdate} disabled={opening}>
              {opening ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name="download" size={18} color="#FFFFFF" />}
              <Text style={styles.primaryText}>{opening ? 'Abrindo...' : 'Baixar atualização'}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.secondaryButton} onPress={runCheck}>
            <Feather name="refresh-cw" size={16} color="#CBD5E1" />
            <Text style={styles.secondaryText}>Verificar novamente</Text>
          </TouchableOpacity>

          {state.source === 'cache' ? (
            <Text style={styles.cacheText}>Usando a última regra de atualização salva neste aparelho.</Text>
          ) : null}
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

async function readCachedDecision(): Promise<AppUpdateDecision | null> {
  try {
    const raw = await AsyncStorage.getItem(UPDATE_CACHE_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as AppUpdateConfig;
    const installed = getInstalledAppVersion();
    if (!shouldForceUpdate(installed.versionCode, config)) return null;
    return {
      installed,
      config,
      mustUpdate: true,
      hasUpdate: hasAvailableUpdate(installed.versionCode, config),
    };
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('update_check_timeout')), timeoutMs);
    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: '#0F172A',
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#243044',
    backgroundColor: '#111827',
    padding: 24,
  },
  iconWrap: {
    width: 66,
    height: 66,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    marginBottom: 10,
  },
  message: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 18,
  },
  versionBox: {
    borderRadius: 8,
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
    marginBottom: 18,
  },
  versionLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  versionValue: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  primaryButton: {
    height: 54,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginBottom: 10,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '800',
  },
  cacheText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
});
