import React, { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '../components/ui';
import { ProductIdentity, RiskBar } from '../components/brand';
import { useTheme } from '../context/ThemeContext';
import { FontSize, FontWeight } from '../constants/Typography';
import { Spacing, SpacingAlias } from '../constants/Spacing';

type Tone = 'primary' | 'success' | 'warning' | 'danger';

interface Tile {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  caption: string;
  tone: Tone;
  wide?: boolean;
}

interface SlideData {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  hero?: boolean;
  tiles: Tile[];
}

const SLIDES: SlideData[] = [
  {
    id: 'welcome',
    eyebrow: 'BEM-VINDO AO TCS',
    title: 'A operação de campo, organizada.',
    description: 'Uma experiência única para vistoria, classificação de risco e gestão técnica.',
    hero: true,
    tiles: [
      { icon: 'clipboard', title: 'Vistoria', caption: 'Fluxo técnico guiado', tone: 'primary', wide: true },
      { icon: 'map-pin', title: 'GPS', caption: 'Localização confiável', tone: 'warning' },
      { icon: 'file-text', title: 'Laudo', caption: 'PDF em campo', tone: 'success' },
    ],
  },
  {
    id: 'field',
    eyebrow: 'TRABALHO EM CAMPO',
    title: 'Registre com contexto, mesmo offline.',
    description: 'O TCS mantém a vistoria disponível e organiza cada evidência até a sincronização.',
    tiles: [
      { icon: 'wifi-off', title: 'Modo offline', caption: 'Continue trabalhando sem sinal', tone: 'warning', wide: true },
      { icon: 'camera', title: 'Evidências', caption: 'Fotos vinculadas', tone: 'primary' },
      { icon: 'navigation', title: 'Território', caption: 'GPS e endereço', tone: 'success' },
      { icon: 'refresh-cw', title: 'Sincronização', caption: 'Retomada automática', tone: 'primary', wide: true },
    ],
  },
  {
    id: 'risk',
    eyebrow: 'DECISÃO TÉCNICA',
    title: 'Risco legível em cada etapa.',
    description: 'Classificação R1 a R4 com rótulo, cor semântica e histórico para auditoria.',
    tiles: [
      { icon: 'check-circle', title: 'R1 · Baixo', caption: 'Acompanhamento', tone: 'success' },
      { icon: 'alert-circle', title: 'R2 · Médio', caption: 'Atenção técnica', tone: 'warning' },
      { icon: 'alert-triangle', title: 'R3 · Alto', caption: 'Ação prioritária', tone: 'warning' },
      { icon: 'x-octagon', title: 'R4 · Crítico', caption: 'Resposta imediata', tone: 'danger' },
    ],
  },
  {
    id: 'profiles',
    eyebrow: 'UMA PLATAFORMA, VÁRIOS PERFIS',
    title: 'Cada equipe vê o que precisa.',
    description: 'Módulos e ações são adaptados ao papel e ao contexto da conta.',
    tiles: [
      { icon: 'user', title: 'Agente', caption: 'Campo e laudos', tone: 'primary' },
      { icon: 'users', title: 'Supervisor', caption: 'Equipe e agenda', tone: 'success' },
      { icon: 'shield', title: 'Municipal', caption: 'Gestão e auditoria', tone: 'warning' },
      { icon: 'activity', title: 'Gestão TCS', caption: 'Visão da operação', tone: 'primary' },
    ],
  },
];

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [current, setCurrent] = useState(0);
  const listRef = useRef<FlatList<SlideData>>(null);
  const isLast = current === SLIDES.length - 1;

  const complete = async () => {
    await AsyncStorage.setItem('@onboarding_done', '1');
    router.replace('/(auth)');
  };

  const next = () => {
    if (isLast) {
      complete();
      return;
    }
    const target = current + 1;
    listRef.current?.scrollToIndex({ index: target, animated: true });
    setCurrent(target);
  };

  const tone = (value: Tone) => {
    if (value === 'success') return { color: theme.success, background: theme.successLight };
    if (value === 'warning') return { color: theme.warning, background: theme.warningLight };
    if (value === 'danger') return { color: theme.error, background: theme.errorLight };
    return { color: theme.primary, background: theme.secondary };
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <View style={[styles.stepChip, { backgroundColor: theme.secondary }]}>
          <Text style={[styles.stepText, { color: theme.primary }]}>{current + 1} de {SLIDES.length}</Text>
        </View>
        {!isLast ? (
          <Pressable onPress={complete} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.skipText, { color: theme.textSecondary }]}>Pular apresentação</Text>
          </Pressable>
        ) : <View />}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        onMomentumScrollEnd={({ nativeEvent }) => setCurrent(Math.round(nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.copy}>
              {item.hero ? <ProductIdentity variant="compact" /> : null}
              <Text style={[styles.eyebrow, { color: theme.primary }]}>{item.eyebrow}</Text>
              <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>{item.description}</Text>
              {item.id === 'risk' ? <RiskBar labelled width={240} /> : null}
            </View>

            <View style={styles.grid}>
              {item.tiles.map(tile => {
                const colors = tone(tile.tone);
                return (
                  <Card
                    key={`${item.id}-${tile.title}`}
                    variant="outlined"
                    style={tile.wide ? { ...styles.tile, ...styles.tileWide } : styles.tile}
                  >
                    <View style={[styles.tileIcon, { backgroundColor: colors.background }]}>
                      <Feather name={tile.icon} size={21} color={colors.color} />
                    </View>
                    <Text style={[styles.tileTitle, { color: theme.text }]}>{tile.title}</Text>
                    <Text style={[styles.tileCaption, { color: theme.textSecondary }]}>{tile.caption}</Text>
                  </Card>
                );
              })}
            </View>
          </View>
        )}
      />

      <View style={styles.bottomBar}>
        <View style={styles.progressRow}>
          {SLIDES.map((slide, index) => (
            <View
              key={slide.id}
              style={[
                styles.progressSegment,
                { backgroundColor: index <= current ? theme.primary : theme.border },
              ]}
            />
          ))}
        </View>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={next}
          iconRight={<Feather name={isLast ? 'check' : 'arrow-right'} size={19} color={theme.onPrimary} />}
        >
          {isLast ? 'Entrar no TCS' : 'Continuar'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { minHeight: 52, paddingHorizontal: Spacing[5], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepChip: { minHeight: 32, borderRadius: SpacingAlias.radiusFull, paddingHorizontal: Spacing[3], justifyContent: 'center' },
  stepText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  skipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  slide: { paddingHorizontal: Spacing[5], paddingTop: Spacing[5], paddingBottom: 150, gap: Spacing[6] },
  copy: { gap: Spacing[3], alignItems: 'flex-start' },
  eyebrow: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 1.2 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: FontWeight.extrabold, letterSpacing: -1 },
  description: { fontSize: FontSize.base, lineHeight: 21, maxWidth: 340 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  tile: { width: '48%', flexGrow: 1, minWidth: 142, minHeight: 132, padding: Spacing[4] },
  tileWide: { width: '100%', minHeight: 116 },
  tileIcon: { width: 42, height: 42, borderRadius: SpacingAlias.radiusMd, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[3] },
  tileTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  tileCaption: { fontSize: FontSize.xs, lineHeight: 16, marginTop: 3 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing[5], paddingTop: Spacing[4], paddingBottom: Spacing[5], gap: Spacing[4] },
  progressRow: { flexDirection: 'row', gap: Spacing[2] },
  progressSegment: { flex: 1, height: 4, borderRadius: SpacingAlias.radiusFull },
});
