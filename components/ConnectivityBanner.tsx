import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useConnectivity } from '../context/ConnectivityContext';
import { useTheme } from '../context/ThemeContext';

const PILL_HEIGHT = 36;
const ANIM_DURATION = 300;

export function ConnectivityBanner() {
  const { isOnlineReal } = useConnectivity();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Bottom position: above the bottom nav bar (approx 60px) + safe area
  const pillBottom = insets.bottom + 68;
  // Slide from below the screen (hidden position)
  const hiddenOffset = PILL_HEIGHT + pillBottom + 16;

  const translateY = useRef(new Animated.Value(hiddenOffset)).current;
  const [bannerState, setBannerState] = useState<'offline' | 'restored' | 'hidden'>('hidden');
  const prevOnline = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = (state: 'offline' | 'restored') => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setBannerState(state);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
  };

  const hideBanner = () => {
    Animated.timing(translateY, {
      toValue: hiddenOffset,
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
  const backgroundColor = isOffline ? theme.warning : theme.success;

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          bottom: pillBottom,
          backgroundColor,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <Feather name={isOffline ? 'wifi-off' : 'wifi'} size={13} color="#fff" />
      <Text style={styles.text}>
        {isOffline
          ? 'Sem conexão — dados sincronizados ao reconectar'
          : 'Conexão restaurada'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    // Left/right not set — pill width is determined by content + padding
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: PILL_HEIGHT,
    zIndex: 9999,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
