import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useSubscription } from '../context/SubscriptionContext';
import { navSystemBottom } from '../utils/useBottomTabPadding';
import { FontSize, FontWeight } from '../constants/Typography';
import { Spacing, SpacingAlias } from '../constants/Spacing';

interface NavTab {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  route: string;
  matchPaths?: string[];
}

const TABS_AGENT: NavTab[] = [
  { key: 'home', label: 'Início', icon: 'home', route: '/(panel)/dashboard', matchPaths: ['/dashboard'] },
  { key: 'inspecoes', label: 'Vistorias', icon: 'clipboard', route: '/(panel)/inspecoes', matchPaths: ['/inspecoes'] },
  { key: 'avisos', label: 'Avisos', icon: 'bell', route: '/(panel)/avisos', matchPaths: ['/avisos'] },
  { key: 'modulos', label: 'Módulos', icon: 'grid', route: '/(panel)/modulos', matchPaths: ['/modulos'] },
];

const TABS_SUPERVISOR: NavTab[] = [
  { key: 'home', label: 'Início', icon: 'home', route: '/(panel)/supervisor', matchPaths: ['/supervisor'] },
  { key: 'inspecoes', label: 'Vistorias', icon: 'clipboard', route: '/(panel)/inspecoes', matchPaths: ['/inspecoes'] },
  { key: 'avisos', label: 'Avisos', icon: 'bell', route: '/(panel)/avisos', matchPaths: ['/avisos'] },
  { key: 'modulos', label: 'Módulos', icon: 'grid', route: '/(panel)/modulos', matchPaths: ['/modulos'] },
];

const TABS_ADMIN: NavTab[] = [
  { key: 'home', label: 'Início', icon: 'home', route: '/(panel)/admin', matchPaths: ['/admin'] },
  { key: 'mapas', label: 'Mapa', icon: 'map-pin', route: '/(panel)/mapas', matchPaths: ['/mapas'] },
  { key: 'avisos', label: 'Avisos', icon: 'bell', route: '/(panel)/avisos', matchPaths: ['/avisos'] },
  { key: 'modulos', label: 'Módulos', icon: 'grid', route: '/(panel)/modulos', matchPaths: ['/modulos'] },
];

const TABS_MASTER: NavTab[] = [
  { key: 'home', label: 'Início', icon: 'home', route: '/(panel)/master', matchPaths: ['/master'] },
  { key: 'inspecoes', label: 'Vistorias', icon: 'clipboard', route: '/(panel)/inspecoes', matchPaths: ['/inspecoes'] },
  { key: 'avisos', label: 'Avisos', icon: 'bell', route: '/(panel)/avisos', matchPaths: ['/avisos'] },
  { key: 'modulos', label: 'Módulos', icon: 'grid', route: '/(panel)/modulos', matchPaths: ['/modulos'] },
];

const TABS_INTERNAL: NavTab[] = [
  { key: 'home', label: 'Início', icon: 'home', route: '/(panel)/internal', matchPaths: ['/internal'] },
  { key: 'modulos', label: 'Módulos', icon: 'grid', route: '/(panel)/modulos', matchPaths: ['/modulos'] },
  { key: 'perfil', label: 'Perfil', icon: 'user', route: '/(panel)/perfil', matchPaths: ['/perfil'] },
];

const NAVBAR_VISIBLE_PATHS = [
  '/dashboard', '/inspecoes', '/perfil', '/modulos', '/mapas', '/avisos', '/internal',
  '/admin', '/supervisor', '/master', '/admin/relatorios', '/admin/estatisticas', '/admin/form-editor', '/admin/editor-perguntas',
];

interface BottomNavBarInnerProps {
  role: string;
  pathname: string;
  hasOrganization?: boolean;
  noticesEnabled?: boolean;
}

export const BottomNavBarInner = React.memo(function BottomNavBarInner({ role, pathname, hasOrganization = true, noticesEnabled = true }: BottomNavBarInnerProps) {
  const { theme } = useTheme();
  const { badgeCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const normalizedPath = pathname.replace(/\/+$/, '');
  const shouldShow = NAVBAR_VISIBLE_PATHS.some(path => normalizedPath === path || normalizedPath.endsWith(path));

  if (!shouldShow) return null;

  const baseTabs = ['owner', 'developer', 'support', 'auditor'].includes(role)
    ? TABS_INTERNAL
    : role === 'master_admin'
    ? TABS_MASTER
    : role === 'admin'
      ? TABS_ADMIN
      : role === 'supervisor'
        ? TABS_SUPERVISOR
        : TABS_AGENT;

  const tabs = hasOrganization && noticesEnabled
    ? baseTabs
    : baseTabs.map((tab) => {
      if (tab.key !== 'avisos') return tab;
      if (baseTabs.some((item) => item.key === 'mapas')) {
        return { key: 'perfil', label: 'Perfil', icon: 'user' as const, route: '/(panel)/perfil', matchPaths: ['/perfil'] };
      }
      return { key: 'mapas', label: 'Mapa', icon: 'map-pin' as const, route: '/(panel)/mapas', matchPaths: ['/mapas'] };
    });

  const isActive = (tab: NavTab) => (
    (tab.matchPaths ?? [tab.route]).some(path => normalizedPath === path || normalizedPath.endsWith(path))
  );

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View
        style={[
          styles.dock,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            paddingBottom: Math.max(navSystemBottom(insets), Spacing[2]),
          },
        ]}
      >
        {tabs.map(tab => {
          const active = isActive(tab);
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              onPress={() => router.push(tab.route as any)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View style={[styles.iconTile, active && { backgroundColor: theme.secondary }]}>
                <Feather name={tab.icon} size={21} color={active ? theme.primary : theme.textSecondary} />
                {tab.key === 'avisos' && badgeCount > 0 ? (
                  <View style={[styles.badge, { backgroundColor: theme.error }]}>
                    <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, { color: active ? theme.primary : theme.textSecondary }, active && styles.labelActive]}>
                {tab.label}
              </Text>
              <View style={[styles.dot, { backgroundColor: active ? theme.primary : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

export function BottomNavBar() {
  const { profile } = useAuth();
  const { context, hasFeature } = useSubscription();
  const pathname = usePathname();
  if (!profile) return null;
  return (
    <BottomNavBarInner
      role={profile.role}
      pathname={pathname}
      hasOrganization={Boolean(profile.organizationId || context?.organization?.id)}
      noticesEnabled={!context?.features || !('comunicados' in context.features) || hasFeature('comunicados')}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing[3], paddingBottom: Spacing[2] },
  dock: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: SpacingAlias.radiusXl,
    paddingHorizontal: Spacing[2],
    paddingTop: Spacing[2],
    shadowColor: '#171A18',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 16,
  },
  tab: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pressed: { opacity: 0.72 },
  iconTile: { width: 40, height: 30, borderRadius: SpacingAlias.radiusMd, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -5, right: -3, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: FontWeight.extrabold },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  labelActive: { fontWeight: FontWeight.bold },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
