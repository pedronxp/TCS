import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { AppHeader, Button, ErrorState, StateBanner } from '../../../components/ui';
import { buildOwnerConsoleUrl, classifyOwnerConsoleNavigation, OWNER_CONSOLE_SECTIONS } from '../../../services/OwnerConsoleService';

/** Reuses the complete console with its own login; no native tokens are injected or put in URLs. */
export default function OwnerConsoleScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { section = 'home' } = useLocalSearchParams<{ section?: string }>();
  const web = useRef<WebView<object>>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [external, setExternal] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  if (section === 'tokens') return <Redirect href="/(panel)/internal/tokens" />;
  if (section === 'staff') return <Redirect href="/(panel)/internal/equipe" />;
  let url: string;
  try { url = buildOwnerConsoleUrl(section); } catch {
    return <ErrorState message="O endereço do console não está configurado corretamente." onRetry={() => router.back()} />;
  }
  if (profile?.role !== 'owner') return <ErrorState message="Acesso exclusivo do proprietário." onRetry={() => router.back()} />;
  const navigate = (target: string) => {
    const kind = classifyOwnerConsoleNavigation(target);
    if (kind === 'external') setExternal(target);
    return kind === 'internal';
  };
  return <SafeAreaView edges={['top', 'bottom']} style={[styles.screen, { backgroundColor: theme.background }]}>
    <AppHeader title={OWNER_CONSOLE_SECTIONS.find(item => item.key === section)?.title ?? 'Console completo'} subtitle="Administração dentro do aplicativo" onBack={() => canGoBack ? web.current?.goBack() : router.back()} />
    <View style={styles.notice}><Text style={{ color: theme.textSecondary, fontSize: 12 }}>O console mantém seu próprio login e confirmação de segurança. Ao fechar esta tela, a sessão isolada é encerrada.</Text></View>
    {external && <View style={styles.notice}><StateBanner variant="info" title="Link externo" description={new URL(external).hostname} /><Button variant="secondary" label="Abrir no navegador" onPress={() => { void Linking.openURL(external); setExternal(null); }} /><Button variant="ghost" label="Continuar no console" onPress={() => setExternal(null)} /></View>}
    {Platform.OS === 'web' ? <View style={styles.notice}><Button label="Abrir console" onPress={() => { void Linking.openURL(url); }} /></View> : <>
      {loading && !failed && <ActivityIndicator accessibilityLabel="Carregando console" color={theme.primary} style={styles.loading} />}
      {failed && <View style={styles.notice}><StateBanner variant="warning" title="Não foi possível carregar o console" description="Confira a conexão. Os controles nativos continuam disponíveis no aplicativo." /><Button label="Tentar novamente" onPress={() => { setFailed(false); setLoading(true); setRevision(value => value + 1); }} /></View>}
      {!failed && <WebView<object> key={`${profile.uid}:${section}:${revision}`} ref={web} source={{ uri: url }} style={styles.web}
        incognito sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} cacheEnabled={false}
        originWhitelist={['https://*', 'about:blank', 'blob:*']} mixedContentMode="never" allowFileAccess={false}
        setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically
        onShouldStartLoadWithRequest={request => navigate(request.url)}
        onOpenWindow={event => { if (classifyOwnerConsoleNavigation(event.nativeEvent.targetUrl) === 'external') setExternal(event.nativeEvent.targetUrl); }}
        onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
        onLoadStart={() => setLoading(true)} onLoadEnd={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
        onHttpError={event => { if (event.nativeEvent.statusCode >= 400) { setFailed(true); setLoading(false); } }}
      />}
    </>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, web: { flex: 1 }, notice: { padding: 12, gap: 8 }, loading: { padding: 8 } });
