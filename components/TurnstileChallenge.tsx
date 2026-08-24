import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  buildTurnstileChallengeHtml,
  parseTurnstileMessage,
  type TurnstileConfiguration,
} from '../services/TurnstileService';

interface Props {
  configuration: TurnstileConfiguration;
  onToken: (token: string | null) => void;
}

export function TurnstileChallenge({ configuration, onToken }: Props) {
  const html = useMemo(() => buildTurnstileChallengeHtml(configuration), [configuration]);
  if (!configuration.enabled || !html) return null;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html, baseUrl: configuration.origin }}
        originWhitelist={['https://*', 'http://localhost', 'http://127.0.0.1', 'about:blank']}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        scrollEnabled={false}
        style={styles.webview}
        onMessage={(event) => onToken(parseTurnstileMessage(event.nativeEvent.data))}
        onError={() => onToken(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 72, overflow: 'hidden' },
  webview: { height: 72, backgroundColor: 'transparent' },
});
