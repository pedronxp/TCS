import { View, Text, SafeAreaView, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui';
import { Typography } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';

export default function WelcomeScreen() {
  const { theme, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.container}>

        {/* ── Top spacer ── */}
        <View style={styles.topSpacer} />

        {/* ── Logo + Branding ── */}
        <View style={styles.brand}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />

          <Text style={[styles.appName, { color: theme.text }]}>
            TCS
          </Text>
          <View style={[styles.divider, { backgroundColor: theme.primary }]} />
          <Text style={[styles.appTagline, { color: theme.textSecondary }]}>
            Relatório e Vistoria
          </Text>
        </View>

        <Text style={[styles.description, { color: theme.muted ?? theme.textSecondary }]}>
          Plataforma inteligente para gestão{'\n'}de riscos e laudos técnicos
        </Text>

        {/* ── Bottom spacer ── */}
        <View style={styles.bottomSpacer} />

        {/* ── CTAs ── */}
        <View style={styles.ctas}>
          <Button
            variant="primary"
            label="Entrar"
            onPress={() => router.push('/(auth)/login')}
          />
          <Button
            variant="secondary"
            label="Conhecer o App"
            onPress={() => router.push('/onboarding')}
          />
          <Button
            variant="ghost"
            label="Validar Token de Acesso"
            onPress={() => router.push('/(auth)/register')}
          />
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Feather name="lock" size={11} color={theme.muted ?? theme.textSecondary} />
          <Text style={[styles.footerText, { color: theme.muted ?? theme.textSecondary }]}>
            Acesso restrito a usuários credenciados
          </Text>
        </View>

        {/* ── Créditos ── */}
        <Text style={[styles.credits, { color: theme.muted ?? theme.textSecondary }]}>
          Desenvolvido por Pedronxp · v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing[8],
  },

  topSpacer: { flex: 1.2 },
  bottomSpacer: { flex: 1 },

  /* ── Branding ── */
  brand: {
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: Spacing[5],
  },
  appName: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 2,
  },
  divider: {
    width: 40,
    height: 3,
    borderRadius: 2,
    marginVertical: Spacing[3],
  },
  appTagline: {
    fontSize: Typography.subtitle.size,
    fontWeight: Typography.subtitle.weight,
  },
  description: {
    fontSize: Typography.body.size,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: Spacing[6],
    maxWidth: 280,
  },

  /* ── CTAs ── */
  ctas: {
    width: '100%',
    gap: Spacing[3],
    marginBottom: Platform.OS === 'ios' ? Spacing[4] : Spacing[6],
  },

  /* ── Footer ── */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingBottom: Platform.OS === 'ios' ? 0 : Spacing[4],
  },
  footerText: {
    fontSize: Typography.caption.size,
  },
  credits: {
    fontSize: 10,
    opacity: 0.45,
    paddingBottom: Platform.OS === 'ios' ? 8 : Spacing[4],
    marginTop: Spacing[1],
  },
});
