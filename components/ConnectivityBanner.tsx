import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useConnectivity } from '../context/ConnectivityContext';

const STRIP_HEIGHT = 34;
const ANIM_DURATION = 280;

export function ConnectivityBanner() {
  // isConnected = NetInfo (instantâneo), sem delay de HTTP check
  const { isConnected } = useConnectivity();
  const insets = useSafeAreaInsets();

  // Posição acima da barra de navegação
  const bottomOffset = insets.bottom + 72;
  const translateY = useRef(new Animated.Value(STRIP_HEIGHT + 10)).current;
  const [bannerState, setBannerState] = useState<'offline' | 'restored' | 'hidden'>('hidden');
  const prevConnected = useRef<boolean | null>(null); // null = ainda não inicializado
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = (state: 'offline' | 'restored') => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setBannerState(state);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 14,
    }).start();
  };

  const hideBanner = () => {
    Animated.timing(translateY, {
      toValue: STRIP_HEIGHT + 10,
      duration: ANIM_DURATION,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setBannerState('hidden');
    });
  };

  useEffect(() => {
    const wasConnected = prevConnected.current;
    prevConnected.current = isConnected;

    if (!isConnected) {
      // Mostra offline sempre que desconectado (inclusive no boot do app)
      showBanner('offline');
    } else if (isConnected && wasConnected === false) {
      // Só mostra "restaurado" se antes estava offline (não na inicialização)
      showBanner('restored');
      hideTimer.current = setTimeout(() => hideBanner(), 2500);
    }

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isConnected]);

  if (bannerState === 'hidden') return null;

  const isOffline = bannerState === 'offline';

  return (
    <Animated.View
      style={[
        styles.strip,
        {
          bottom: bottomOffset,
          backgroundColor: isOffline ? '#92400E' : '#065F46',
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <Feather name={isOffline ? 'wifi-off' : 'wifi'} size={12} color="#fff" />
      <Text style={styles.text}>
        {isOffline ? 'Modo offline · dados locais' : 'Conexão restaurada'}
      </Text>
      {isOffline && (
        <View style={styles.dot} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    height: STRIP_HEIGHT,
    zIndex: 9999,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FCA5A5',
  },
});
