import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { AppStateStatus } from 'react-native';
import { AppState, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import type { AppUpdateConfig, AppUpdateDecision } from '../utils/appUpdate';
import { checkAndroidAppUpdate, getInstalledAppVersion, hasAvailableUpdate, shouldForceUpdate } from '../utils/appUpdate';
import { useTheme } from '../context/ThemeContext';
import { FontSize, FontWeight } from '../constants/Typography';
import { Spacing, SpacingAlias } from '../constants/Spacing';
import { OpeningBoot, ProductIdentity } from './brand';
import { Button, Card, StateBanner } from './ui';

const UPDATE_CACHE_KEY = '@app_update_config_android_v1';
const UPDATE_CHECK_TIMEOUT_MS = 6000;

type GateState =
  | { status: 'checking' }
  | { status: 'allowed' }
  | { status: 'blocked'; decision: AppUpdateDecision; source: 'remote' | 'cache' };

export function ForceUpdateGate({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const [state, setState] = useState<GateState>(
    Platform.OS === 'android' ? { status: 'checking' } : { status: 'allowed' },
  );
  const [opening, setOpening] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const checkingRef = useRef(false);
  const stateRef = useRef<GateState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const runCheck = async (showLoading: boolean) => {
    if (Platform.OS !== 'android') {
      setState({ status: 'allowed' });
      return;
    }
    if (checkingRef.current) return;
    checkingRef.current = true;
    if (showLoading) setState({ status: 'checking' });
    try {
      const decision = await withTimeout(checkAndroidAppUpdate(), UPDATE_CHECK_TIMEOUT_MS);
      if (decision.config) await AsyncStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify(decision.config));
      setState(decision.mustUpdate ? { status: 'blocked', decision, source: 'remote' } : { status: 'allowed' });
    } catch {
      const cached = await readCachedDecision();
      setState(cached ? { status: 'blocked', decision: cached, source: 'cache' } : { status: 'allowed' });
    } finally {
      checkingRef.current = false;
    }
  };

  useEffect(() => {
    runCheck(true);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', nextState => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if ((previousState === 'background' || previousState === 'inactive') && nextState === 'active') {
        runCheck(stateRef.current.status === 'blocked');
      }
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

  if (state.status === 'checking') return <OpeningBoot />;

  if (state.status === 'blocked') {
    const { installed, config } = state.decision;
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ProductIdentity variant="compact" />
        <Card style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: theme.warningLight }]}>
            <Feather name="download-cloud" size={30} color={theme.warning} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Atualização necessária</Text>
          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {config?.message || 'Existe uma nova versão do aplicativo. Atualize para continuar usando o sistema.'}
          </Text>

          <View style={styles.versionGrid}>
            <View style={[styles.versionCell, { backgroundColor: theme.secondary }]}>
              <Text style={[styles.versionLabel, { color: theme.textSecondary }]}>INSTALADA</Text>
              <Text style={[styles.versionValue, { color: theme.text }]}>{installed.version}</Text>
              <Text style={[styles.buildValue, { color: theme.textSecondary }]}>build {installed.versionCode}</Text>
            </View>
            <View style={[styles.versionCell, { backgroundColor: theme.warningLight }]}>
              <Text style={[styles.versionLabel, { color: theme.warning }]}>EXIGIDA</Text>
              <Text style={[styles.versionValue, { color: theme.text }]}>{config?.latestVersion || '—'}</Text>
              <Text style={[styles.buildValue, { color: theme.textSecondary }]}>build {config?.minRequiredVersionCode ?? '—'}</Text>
            </View>
          </View>

          {state.source === 'cache' ? (
            <StateBanner
              title="Regra salva no aparelho"
              description="Conecte-se para consultar novamente a versão disponível."
              variant="warning"
            />
          ) : null}

          {config?.apkUrl ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={openUpdate}
              loading={opening}
              iconLeft={<Feather name="download" size={18} color={theme.onPrimary} />}
            >
              Baixar atualização
            </Button>
          ) : null}
          <Button
            variant="ghost"
            fullWidth
            onPress={() => runCheck(true)}
            iconLeft={<Feather name="refresh-cw" size={17} color={theme.text} />}
          >
            Verificar novamente
          </Button>
        </Card>
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
    return { installed, config, mustUpdate: true, hasUpdate: hasAvailableUpdate(installed.versionCode, config) };
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
  container: { flex: 1, justifyContent: 'center', padding: Spacing[5], gap: Spacing[6] },
  card: { padding: Spacing[5], gap: Spacing[4] },
  iconWrap: { width: 58, height: 58, borderRadius: SpacingAlias.radiusLg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, lineHeight: 32, fontWeight: FontWeight.extrabold, letterSpacing: -0.6 },
  message: { fontSize: FontSize.base, lineHeight: 21 },
  versionGrid: { flexDirection: 'row', gap: Spacing[3] },
  versionCell: { flex: 1, borderRadius: SpacingAlias.radiusMd, padding: Spacing[3] },
  versionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 0.8 },
  versionValue: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, marginTop: Spacing[2] },
  buildValue: { fontSize: FontSize.xs, marginTop: 2 },
});
