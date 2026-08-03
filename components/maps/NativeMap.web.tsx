import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type MapType = 'standard' | 'satellite' | 'hybrid' | 'terrain' | 'none' | 'mutedStandard';

type MapProps = React.ComponentProps<typeof View> & {
  children?: React.ReactNode;
};

const MapView = forwardRef<unknown, MapProps>(({ children, style, ...props }, ref) => {
  useImperativeHandle(ref, () => ({
    animateToRegion: () => undefined,
    fitToCoordinates: () => undefined,
  }));

  return (
    <View {...props} style={[styles.container, style]}>
      <Text style={styles.label}>Mapa disponível no aplicativo Android e iOS</Text>
      {children}
    </View>
  );
});

MapView.displayName = 'MapViewWebFallback';

export const Marker = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const Heatmap = () => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#EDF3F0',
    justifyContent: 'center',
  },
  label: {
    color: '#2F6B5B',
    fontSize: 14,
    fontWeight: '600',
    padding: 24,
    textAlign: 'center',
  },
});

export default MapView;
