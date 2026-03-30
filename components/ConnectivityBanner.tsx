import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useConnectivity } from '../context/ConnectivityContext';

const BANNER_HEIGHT = 40;
const ANIM_DURATION = 300;

export function ConnectivityBanner() {
  const { isOnlineReal } = useConnectivity();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-(BANNER_HEIGHT + insets.top))).current;
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
      toValue: -(BANNER_HEIGHT + insets.top),
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
        styles.banner,
        {
          backgroundColor: isOffline ? '#F59E0B' : '#10B981',
          paddingTop: insets.top,
          height: BANNER_HEIGHT + insets.top,
          transform: [{ translateY }],
        },
      ]}
    >
      <Feather name={isOffline ? 'wifi-off' : 'wifi'} size={13} color="#fff" />
      <Text style={styles.text}>
        {isOffline
          ? 'Modo Offline — dados sincronizados ao reconectar'
          : 'Conexão restaurada'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
