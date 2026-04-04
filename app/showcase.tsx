import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');

const RISK_COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];
const RISK_LABELS = ['R1', 'R2', 'R3', 'R4'];

const STATS = [
  { value: '10', label: 'Elementos\nAvaliados' },
  { value: 'R1→R4', label: 'Níveis de\nRisco' },
  { value: '100%', label: 'Funciona\nOffline' },
];

const FEATURES = [
  {
    icon: 'clipboard' as const,
    color: '#F59E0B',
    title: 'Vistoria em Campo',
    desc: 'Formulários técnicos com GPS automático e captura de fotos como evidência.',
  },
  {
    icon: 'file-text' as const,
    color: '#8B5CF6',
    title: 'Laudo PDF Técnico',
    desc: 'Relatório completo gerado instantaneamente ao fim de cada vistoria.',
  },
  {
    icon: 'map-pin' as const,
    color: '#3B82F6',
    title: 'Mapa & GPS',
    desc: 'Georreferenciamento preciso de cada edificação inspecionada.',
  },
  {
    icon: 'wifi-off' as const,
    color: '#10B981',
    title: 'Funciona Offline',
    desc: 'Dados salvos localmente, sincronizados ao reconectar à internet.',
  },
  {
    icon: 'users' as const,
    color: '#06B6D4',
    title: 'Gestão de Equipes',
    desc: 'Agentes, supervisores e grupos organizados por município.',
  },
  {
    icon: 'shield' as const,
    color: '#EF4444',
    title: 'Auditoria & Logs',
    desc: 'Rastreabilidade completa de todas as ações realizadas no sistema.',
  },
];

export default function ShowcaseScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const heroAnim  = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const gridAnim  = useRef(new Animated.Value(0)).current;
  const ctaAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(140, [
      Animated.timing(heroAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(statsAnim, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(gridAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(ctaAnim,   { toValue: 1, duration: 440, useNativeDriver: true }),
    ]).start();
  }, []);

  const fadeSlide = (anim: Animated.Value, offset = 24) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
  });

  const bg      = isDark ? '#080C14' : '#F0F4FF';
  const surface = isDark ? '#0F172A' : '#FFFFFF';
  const border  = isDark ? '#1E293B' : '#E2E8F0';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? '#64748B' : '#94A3B8';
  const primary = '#3B82F6';

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Linhas de fundo decorativas */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {[0, 1, 2, 3, 4].map(i => (
          <View
            key={i}
            style={[
              styles.bgLine,
              {
                top: SCREEN_W * 0.4 * i - 40,
                borderColor: isDark ? 'rgba(59,130,246,0.04)' : 'rgba(59,130,246,0.07)',
              },
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Botão voltar ── */}
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: surface, borderColor: border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={18} color={muted} />
        </TouchableOpacity>

        {/* ── Seção 1: Hero ── */}
        <Animated.View style={[styles.hero, fadeSlide(heroAnim, 28)]}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={[styles.heroTitle, { color: text }]}>TCS</Text>

          {/* Barra R1→R4 */}
          <View style={styles.riskBarRow}>
            {RISK_COLORS.map((c, i) => (
              <View key={i} style={[styles.riskSeg, { backgroundColor: c }]}>
                <Text style={styles.riskSegLabel}>{RISK_LABELS[i]}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.heroSystem, { color: primary }]}>RELATÓRIO E RISCO</Text>
          <Text style={[styles.heroSub, { color: muted }]}>
            Do registro em campo ao laudo técnico — tudo em um só lugar.
          </Text>
        </Animated.View>

        {/* ── Seção 2: Stats ── */}
        <Animated.View style={[styles.statsRow, fadeSlide(statsAnim, 20)]}>
          {STATS.map((s, i) => (
            <View
              key={i}
              style={[
                styles.statCard,
                {
                  backgroundColor: surface,
                  borderColor: border,
                  borderRightWidth: i < STATS.length - 1 ? 1 : 0,
                },
              ]}
            >
              <Text style={[styles.statValue, { color: primary }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: muted }]}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Seção 3: Funcionalidades ── */}
        <Animated.View style={[styles.section, fadeSlide(gridAnim, 18)]}>
          <Text style={[styles.sectionLabel, { color: muted }]}>FUNCIONALIDADES</Text>
          <View style={styles.grid}>
            {FEATURES.map((f, i) => (
              <View
                key={i}
                style={[styles.featureCard, { backgroundColor: surface, borderColor: border }]}
              >
                <View style={[styles.featureIcon, { backgroundColor: `${f.color}18` }]}>
                  <Feather name={f.icon} size={22} color={f.color} />
                </View>
                <Text style={[styles.featureTitle, { color: text }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: muted }]}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── Seção 4: CTA ── */}
        <Animated.View style={[styles.ctaSection, fadeSlide(ctaAnim, 16)]}>
          <View style={[styles.divider, { backgroundColor: border }]} />
          <Text style={[styles.ctaCaption, { color: muted }]}>
            Acesso restrito · Credencial necessária
          </Text>
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: primary }]}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.82}
          >
            <Feather name="log-in" size={18} color="#FFF" />
            <Text style={styles.btnPrimaryText}>ENTRAR NO SISTEMA</Text>
            <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  bgLine: {
    position: 'absolute',
    left: -SCREEN_W * 0.3,
    width: SCREEN_W * 2,
    height: 1,
    borderTopWidth: 1,
    transform: [{ rotate: '-18deg' }],
  },

  scroll: {
    paddingHorizontal: 24,
    gap: 28,
  },

  backBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'flex-start',
  },

  /* ── Hero ── */
  hero: { alignItems: 'center', paddingTop: 8, gap: 10 },
  logo: { width: 96, height: 96, marginBottom: 4 },
  heroTitle: {
    fontSize: 56, fontWeight: '900', letterSpacing: -2, lineHeight: 60,
  },
  riskBarRow: {
    flexDirection: 'row', gap: 4, width: 148, height: 28, borderRadius: 8, overflow: 'hidden',
  },
  riskSeg: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  riskSegLabel: {
    color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5,
  },
  heroSystem: {
    fontSize: 11, fontWeight: '800', letterSpacing: 3.5,
  },
  heroSub: {
    fontSize: 13, fontWeight: '400', textAlign: 'center',
  },

  /* ── Stats ── */
  statsRow: {
    flexDirection: 'row', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'transparent',
  },
  statCard: {
    flex: 1, paddingVertical: 18, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: 'transparent',
  },
  statValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 14 },

  /* ── Section ── */
  section: { gap: 14 },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 2.5,
  },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  featureCard: {
    width: (SCREEN_W - 48 - 12) / 2,
    borderRadius: 16, borderWidth: 1,
    padding: 16, gap: 10,
  },
  featureIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  featureTitle: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  featureDesc: { fontSize: 12, lineHeight: 17, fontWeight: '400' },

  /* ── CTA ── */
  ctaSection: { gap: 16 },
  divider: { height: 1, width: '100%' },
  ctaCaption: { fontSize: 12, textAlign: 'center', fontWeight: '500' },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 17, borderRadius: 14,
  },
  btnPrimaryText: {
    color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1.5,
    flex: 1, textAlign: 'center',
  },
});
