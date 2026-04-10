import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Platform,
  Animated, TouchableOpacity, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useTheme } from '../../context/ThemeContext';
import { Spacing } from '../../constants/Spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');
const RISK_COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];

export default function WelcomeScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const logoAnim   = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim    = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const dotAnim    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(130, [
      Animated.timing(logoAnim,   { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(headerAnim, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(ctaAnim,    { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(footerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      // Após entrada, logo respira suavemente
      Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, { toValue: 1.08, duration: 2400, useNativeDriver: true }),
          Animated.timing(breatheAnim, { toValue: 1,    duration: 2400, useNativeDriver: true }),
        ])
      ).start();
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 0.25, duration: 1100, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 1,    duration: 1100, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── Paleta adaptada ao tema ──────────────────────────────────────────────
  const bg          = isDark ? '#080C14' : '#F0F4FF';
  const surface     = isDark ? '#0F172A' : '#FFFFFF';
  const border      = isDark ? '#1E293B' : '#E2E8F0';
  const textPrimary = isDark ? '#F1F5F9' : '#0F172A';
  const textMuted   = isDark ? '#4B5563' : '#94A3B8';
  const primary     = '#3B82F6';

  return (
    <View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Linhas de fundo decorativas ─────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <View
            key={i}
            style={[
              styles.bgLine,
              {
                top: SCREEN_W * 0.38 * i - 60,
                borderColor: isDark
                  ? 'rgba(59,130,246,0.045)'
                  : 'rgba(59,130,246,0.07)',
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.container}>

        <View style={{ flex: 1.3 }} />

        {/* ── Logo ────────────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.logoBlock,
            {
              opacity: logoAnim,
              transform: [
                {
                  translateY: logoAnim.interpolate({
                    inputRange: [0, 1], outputRange: [28, 0],
                  }),
                },
                {
                  scale: logoAnim.interpolate({
                    inputRange: [0, 1], outputRange: [0.82, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Animated.Image
            source={require('../../assets/logo.png')}
            style={[styles.logo, { transform: [{ scale: breatheAnim }] }]}
            resizeMode="contain"
          />
        </Animated.View>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.headerBlock,
            {
              opacity: headerAnim,
              transform: [{
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1], outputRange: [18, 0],
                }),
              }],
            },
          ]}
        >
          <Text style={[styles.appName, { color: textPrimary }]}>TCS</Text>

          {/* Barra de risco R1 → R4 */}
          <View style={styles.riskBar}>
            {RISK_COLORS.map((c, i) => (
              <View key={i} style={[styles.riskSegment, { backgroundColor: c }]} />
            ))}
          </View>

          <Text style={[styles.appSystem, { color: primary }]}>RELATÓRIO E RISCO</Text>
          <Text style={[styles.appSub, { color: textMuted }]}>
            Sistema de Vistoria Técnica · Defesa Civil
          </Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        {/* ── CTAs ────────────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.ctas,
            {
              opacity: ctaAnim,
              transform: [{
                translateY: ctaAnim.interpolate({
                  inputRange: [0, 1], outputRange: [22, 0],
                }),
              }],
            },
          ]}
        >
          {/* Botão principal */}
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: primary }]}
            onPress={() => router.push('/showcase')}
            activeOpacity={0.82}
          >
            <Feather name="log-in" size={18} color="#FFF" />
            <Text style={styles.btnPrimaryText}>ACESSAR SISTEMA</Text>
            <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>

          {/* Botões secundários lado a lado */}
          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: border, backgroundColor: surface }]}
              onPress={() => router.push('/onboarding')}
              activeOpacity={0.8}
            >
              <Feather name="info" size={14} color={textMuted} />
              <Text style={[styles.btnSecondaryText, { color: textMuted }]}>Conhecer o App</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: border, backgroundColor: surface }]}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.8}
            >
              <Feather name="key" size={14} color={textMuted} />
              <Text style={[styles.btnSecondaryText, { color: textMuted }]}>Validar Token</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.footer,
            { opacity: footerAnim, borderTopColor: border, paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {/* Status online */}
          <View style={styles.statusRow}>
            <Animated.View style={[styles.statusDot, { opacity: dotAnim }]} />
            <Text style={styles.statusText}>SISTEMA ONLINE</Text>
          </View>

          {/* Linha inferior: lock + créditos */}
          <View style={styles.footerBottom}>
            <View style={styles.lockRow}>
              <Feather name="shield" size={11} color={textMuted} />
              <Text style={[styles.footerText, { color: textMuted }]}>
                Acesso restrito · Credencial necessária
              </Text>
            </View>
            <Text style={[styles.credits, { color: textMuted }]}>
              Pedronxp · v{Constants.expoConfig?.version ?? '1.0.0'}
            </Text>
          </View>
        </Animated.View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing[8],
  },

  /* ── Fundo ── */
  bgLine: {
    position: 'absolute',
    left: -SCREEN_W * 0.3,
    width: SCREEN_W * 2,
    height: 1,
    borderTopWidth: 1,
    transform: [{ rotate: '-20deg' }],
  },

  /* ── Logo ── */
  logoBlock: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 104,
    height: 104,
  },

  /* ── Header ── */
  headerBlock: {
    alignItems: 'center',
    gap: 8,
  },
  appName: {
    fontSize: 60,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 64,
  },
  riskBar: {
    flexDirection: 'row',
    width: 60,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    gap: 2,
  },
  riskSegment: {
    flex: 1,
    borderRadius: 2,
  },
  appSystem: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3.5,
  },
  appSub: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },

  /* ── CTAs ── */
  ctas: {
    width: '100%',
    gap: 10,
    marginBottom: Platform.OS === 'ios' ? Spacing[2] : Spacing[4],
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 17,
    borderRadius: 14,
    width: '100%',
  },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    flex: 1,
    textAlign: 'center',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* ── Footer ── */
  footer: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 4 : Spacing[3],
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  footerBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  footerText: {
    fontSize: 11,
    flexShrink: 1,
  },
  credits: {
    fontSize: 10,
    opacity: 0.5,
  },
});
