import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Platform,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui';
import { Typography } from '../constants/Typography';
import { Spacing, SpacingAlias } from '../constants/Spacing';

const { width, height: screenHeight } = Dimensions.get('window');
const RISK_COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];
const RISK_LABELS = ['R1', 'R2', 'R3', 'R4'];

interface SlideData {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  title: string;
  subtitle: string;
  features?: { icon: keyof typeof Feather.glyphMap; text: string }[];
  isHero?: boolean;
}

const SLIDES: SlideData[] = [
  {
    id: '1',
    icon: 'shield',
    color: '#3B82F6',
    title: 'TCS',
    subtitle: 'Sistema de Vistoria Técnica da Defesa Civil — versão mobile completa.',
    isHero: true,
    features: [
      { icon: 'check-circle', text: '10 elementos estruturais avaliados' },
      { icon: 'check-circle', text: 'Classificação R1 a R4 conforme norma' },
      { icon: 'check-circle', text: 'Laudo PDF gerado em campo' },
    ],
  },
  {
    id: '2',
    icon: 'clipboard',
    color: '#F59E0B',
    title: 'Vistoria\nDireta',
    subtitle: 'Formulários técnicos com fotos, GPS automático e preenchimento offline. Tudo salvo no dispositivo.',
    features: [
      { icon: 'map-pin', text: 'GPS automático por vistoria' },
      { icon: 'camera', text: 'Fotos como evidência' },
      { icon: 'wifi-off', text: 'Funciona sem internet' },
    ],
  },
  {
    id: '3',
    icon: 'alert-triangle',
    color: '#EF4444',
    title: 'Risco\nPreciso',
    subtitle: 'Avaliação de 10 elementos estruturais com classificação automática R1 (seguro) a R4 (crítico).',
    features: [
      { icon: 'check-circle', text: 'R1 · Sem Dano Aparente' },
      { icon: 'alert-circle', text: 'R3 · Alto Risco' },
      { icon: 'x-octagon', text: 'R4 · Interdição Imediata' },
    ],
  },
  {
    id: '4',
    icon: 'file-text',
    color: '#8B5CF6',
    title: 'Laudos\nInstantâneos',
    subtitle: 'Relatório técnico completo com fotos, localização e classificação. Pronto para impressão e envio.',
    features: [
      { icon: 'printer', text: 'PDF pronto para impressão' },
      { icon: 'share-2', text: 'Compartilhe em um toque' },
      { icon: 'file-minus', text: 'Termo de interdição incluso' },
    ],
  },
  {
    id: '5',
    icon: 'users',
    color: '#06B6D4',
    title: 'Gestão\nde Equipes',
    subtitle: 'Supervisores organizam agentes em grupos, criam agendamentos e acompanham vistorias em tempo real.',
    features: [
      { icon: 'grid', text: 'Grupos por área ou turno' },
      { icon: 'calendar', text: 'Agendamento de vistorias' },
      { icon: 'map', text: 'Mapa de cobertura municipal' },
    ],
  },
];

export default function OnboardingScreen() {
  const { theme, isDark } = useTheme();
  const [current, setCurrent] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleFinalizar = async () => {
    await AsyncStorage.setItem('@onboarding_done', '1');
    router.replace('/(auth)');
  };

  const handleNext = () => {
    if (current < SLIDES.length - 1) {
      const next = current + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrent(next);
    }
  };

  const isLast = current === SLIDES.length - 1;
  const slideColor = SLIDES[current].color;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.container}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <View style={{ width: 60 }} />
          <Text style={[styles.topLabel, { color: theme.textSecondary }]}>
            {current + 1} / {SLIDES.length}
          </Text>
          {!isLast ? (
            <TouchableOpacity
              onPress={handleFinalizar}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={[styles.skipText, { color: theme.textSecondary }]}>Pular</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {/* ── Slides ── */}
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled
          keyExtractor={item => item.id}
          onMomentumScrollEnd={({ nativeEvent }) => {
            const index = Math.round(nativeEvent.contentOffset.x / width);
            setCurrent(index);
          }}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width }]}>

              {/* ── Visual ── */}
              {item.isHero ? (
                <Image
                  source={require('../assets/logo.png')}
                  style={styles.heroLogo}
                  contentFit="contain"
                />
              ) : (
                <View style={[styles.iconRing, { borderColor: `${item.color}30` }]}>
                  <View style={[styles.iconDisk, { backgroundColor: `${item.color}15` }]}>
                    <Feather name={item.icon} size={48} color={item.color} />
                  </View>
                </View>
              )}

              {/* ── Barra de risco (só no hero) ── */}
              {item.isHero && (
                <View style={styles.heroRiskBar}>
                  {RISK_COLORS.map((c, i) => (
                    <View key={i} style={[styles.heroRiskSeg, { backgroundColor: c }]}>
                      <Text style={styles.heroRiskLabel}>{RISK_LABELS[i]}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* ── Text ── */}
              <Text style={[styles.slideTitle, { color: theme.text }]}>
                {item.title}
              </Text>
              <Text style={[styles.slideSubtitle, { color: theme.textSecondary }]}>
                {item.subtitle}
              </Text>

              {/* ── Feature chips ── */}
              {item.features && (
                <View style={styles.featureList}>
                  {item.features.map((f: { icon: keyof typeof Feather.glyphMap; text: string }, i: number) => (
                    <View
                      key={i}
                      style={[
                        styles.featureChip,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.04)'
                            : 'rgba(0,0,0,0.03)',
                          borderColor: isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.06)',
                        },
                      ]}
                    >
                      <Feather
                        name={f.icon}
                        size={14}
                        color={item.color}
                      />
                      <Text style={[styles.featureText, { color: theme.text }]}>
                        {f.text}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        />

        {/* ── Bottom controls ── */}
        <View style={styles.bottom}>
          {/* Dots */}
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === current ? slideColor : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'),
                    width: i === current ? 28 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* CTA */}
          <View style={styles.ctaRow}>
            <Button
              variant="primary"
              onPress={isLast ? handleFinalizar : handleNext}
            >
              {isLast ? 'Começar Agora' : 'Próximo'}
            </Button>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },

  /* ── Top bar ── */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing[6],
    paddingTop: Platform.OS === 'ios' ? Spacing[2] : Spacing[4],
    height: 48,
  },
  topLabel: {
    fontSize: Typography.caption.size,
    fontWeight: '600',
    letterSpacing: 1,
  },
  skipText: {
    fontSize: Typography.body.size,
    fontWeight: '500',
    width: 60,
    textAlign: 'right',
  },

  /* ── Slide ── */
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[8],
    paddingBottom: 160,
  },

  /* Hero */
  heroLogo: {
    width: 130,
    height: 130,
    marginBottom: Spacing[6],
  },

  /* Icon ring */
  iconRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing[8],
  },
  iconDisk: {
    width: 114,
    height: 114,
    borderRadius: 57,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Text */
  slideTitle: {
    fontSize: Typography.h1.size,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing[3],
    letterSpacing: -0.5,
    lineHeight: Typography.h1.size * 1.2,
  },
  slideSubtitle: {
    fontSize: Typography.body.size,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
    marginBottom: Spacing[6],
  },

  /* Hero risk bar */
  heroRiskBar: {
    flexDirection: 'row',
    gap: 4,
    width: 148,
    height: 28,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: Spacing[4],
  },
  heroRiskSeg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroRiskLabel: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* Feature chips */
  featureList: {
    gap: Spacing[2],
    width: '100%',
    maxWidth: 300,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderRadius: SpacingAlias.radiusMd,
    borderWidth: 1,
  },
  featureText: {
    fontSize: Typography.bodySmall.size,
    fontWeight: '500',
  },

  /* ── Bottom ── */
  bottom: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? Spacing[8] : Spacing[6],
    left: 0,
    right: 0,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing[6],
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaRow: {
    paddingHorizontal: Spacing[8],
  },
});
