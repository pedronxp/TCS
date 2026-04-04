import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useConnectivity } from '../context/ConnectivityContext';

const STRIP_HEIGHT = 32;
const ANIM_DURATION = 280;

export function ConnectivityBanner() {
  const { isOnlineReal } = useConnectivity();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(-STRIP_HEIGHT)).current;
  const [bannerState, setBannerState] = useState<'offline' | 'restored' | 'hidden'>('hidden');
  const prevOnline = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = (state: 'offline' | 'restored') => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setBannerState(state);
    Animated.timing(translateY, {
      toValue: 0,
      duration: ANIM_DURATION,
      useNativeDriver: true,
    }).start();
  };

  const hideBanner = () => {
    Animated.timing(translateY, {
      toValue: -STRIP_HEIGHT,
      duration: ANIM_DURATION,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setBannerState('hidden');
    });
  };

  useEffect(() => {
    const wasOnline = prevOnline.current;
    prevOnline.current = isOnlineReal;

    if (!isOnlineReal && wasOnline) {
      showBanner('offline');
    } else if (isOnlineReal && !wasOnline) {
      showBanner('restored');
      hideTimer.current = setTimeout(() => hideBanner(), 2500);
    }

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isOnlineReal]);

  if (bannerState === 'hidden') return null;

  const isOffline = bannerState === 'offline';

  return (
    <Animated.View
      style={[
        styles.strip,
        {
          top: insets.top,
          backgroundColor: isOffline ? '#B45309' : '#059669',
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <Feather name={isOffline ? 'wifi-off' : 'wifi'} size={12} color="#fff" />
      <Text style={styles.text}>
        {isOffline
          ? 'Sem conexão — modo offline ativo'
          : 'Conexão restaurada'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: STRIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 10,
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
