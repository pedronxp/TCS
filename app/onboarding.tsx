import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet,
  Dimensions, FlatList
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    icon: 'shield' as const,
    color: '#3B82F6',
    title: 'Defesa Civil Digital',
    subtitle: 'Plataforma integrada para\nvistorias técnicas de risco estrutural',
  },
  {
    id: '2',
    icon: 'wifi-off' as const,
    color: '#10B981',
    title: 'Funciona Offline',
    subtitle: 'Registre vistorias mesmo sem internet.\nSincronização automática ao reconectar.',
  },
  {
    id: '3',
    icon: 'map-pin' as const,
    color: '#F59E0B',
    title: 'Georreferenciamento',
    subtitle: 'Cada vistoria é localizada no mapa\ncom precisão GPS.',
  },
  {
    id: '4',
    icon: 'file-text' as const,
    color: '#8B5CF6',
    title: 'Laudos Técnicos',
    subtitle: 'Gere relatórios PDF completos\ncom um toque.',
  },
];

export default function OnboardingScreen() {
  const { theme } = useTheme();
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.skipBtn}>
        <Button variant="ghost" onPress={() => router.replace('/(auth)')}>
          Pular
        </Button>
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={true}
        keyExtractor={item => item.id}
        onMomentumScrollEnd={({ nativeEvent }) => {
          const index = Math.round(nativeEvent.contentOffset.x / width);
          setCurrent(index);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.iconCircle, { backgroundColor: `${item.color}18` }]}>
              <View style={[styles.iconInner, { backgroundColor: `${item.color}25` }]}>
                <Feather name={item.icon} size={52} color={item.color} />
              </View>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === current ? SLIDES[current].color : theme.border,
                width: i === current ? 28 : 8,
              }
            ]}
          />
        ))}
      </View>

      <View style={[styles.footer, { backgroundColor: theme.background }]}>
        <Button
          variant="primary"
          onPress={isLast ? handleFinalizar : handleNext}
        >
          {isLast ? 'Começar' : 'Próximo'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: {
    position: 'absolute', top: 60, right: 28, zIndex: 10,
  },
  slide: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 48, paddingTop: 100,
  },
  iconCircle: {
    width: 220, height: 220, borderRadius: 110,
    justifyContent: 'center', alignItems: 'center', marginBottom: 60,
  },
  iconInner: {
    width: 160, height: 160, borderRadius: 80,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 20, letterSpacing: -0.8 },
  subtitle: { fontSize: 17, textAlign: 'center', lineHeight: 26, fontWeight: '400' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
  dot: { height: 8, borderRadius: 4 },
  footer: { paddingHorizontal: 32, paddingBottom: 52 },
});
