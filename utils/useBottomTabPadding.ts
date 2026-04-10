/**
 * useBottomTabPadding
 *
 * Returns the amount of bottom padding a ScrollView should use so its content
 * is never hidden behind the BottomNavBar + Android navigation bar.
 *
 * Usage:
 *   const bottomPad = useBottomTabPadding();
 *   <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} />
 */
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Altura visual dos tabs (topBar + iconPill + label + paddingTop) */
const NAVBAR_VISUAL_HEIGHT = 68;

/**
 * Retorna o inset inferior efetivo do sistema para posicionar/espaçar
 * elementos em relação à BottomNavBar.
 * Espelha exatamente o fallback usado pela BottomNavBar:
 *   iOS  → Math.max(insets.bottom, 20)
 *   Android → Math.max(insets.bottom, 16)   ← fallback 16, nunca 0
 */
export function navSystemBottom(insets: { bottom: number }): number {
  return Platform.OS === 'ios'
    ? Math.max(insets.bottom, 20)
    : Math.max(insets.bottom, 16);
}

export function useBottomTabPadding(extraPad = 16): number {
  const insets = useSafeAreaInsets();
  return NAVBAR_VISUAL_HEIGHT + navSystemBottom(insets) + extraPad;
}
