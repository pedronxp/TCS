import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
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
  { key: 'mapas', label: 'Mapa', icon: 'map-pin', route: '/(panel)/mapas', matchPaths: ['/mapas'] },
  { key: 'modulos', label: 'Módulos', icon: 'grid', route: '/(panel)/modulos', matchPaths: ['/modulos'] },
];

const TABS_SUPERVISOR: NavTab[] = [
  { key: 'home', label: 'Início', icon: 'home', route: '/(panel)/supervisor', matchPaths: ['/supervisor'] },
  { key: 'inspecoes', label: 'Vistorias', icon: 'clipboard', route: '/(panel)/inspecoes', matchPaths: ['/inspecoes'] },
  { key: 'mapas', label: 'Mapa', icon: 'map-pin', route: '/(panel)/mapas', matchPaths: ['/mapas'] },
  { key: 'modulos', label: 'Módulos', icon: 'grid', route: '/(panel)/modulos', matchPaths: ['/modulos'] },
];

const TABS_ADMIN: NavTab[] = [
  { key: 'home', label: 'Início', icon: 'home', route: '/(panel)/admin', matchPaths: ['/admin'] },
  { key: 'mapas', label: 'Mapa', icon: 'map-pin', route: '/(panel)/mapas', matchPaths: ['/mapas'] },
  { key: 'formularios', label: 'Formulários', icon: 'edit-3', route: '/(panel)/admin/form-editor', matchPaths: ['/admin/form-editor', '/admin/editor-perguntas'] },
  { key: 'relatorios', label: 'Relatórios', icon: 'bar-chart-2', route: '/(panel)/admin/relatorios', matchPaths: ['/admin/relatorios'] },
  { key: 'modulos', label: 'Módulos', icon: 'grid', route: '/(panel)/modulos', matchPaths: ['/modulos'] },
];

const TABS_MASTER: NavTab[] = [
  { key: 'home', label: 'Início', icon: 'home', route: '/(panel)/master', matchPaths: ['/master'] },
  { key: 'inspecoes', label: 'Vistorias', icon: 'clipboard', route: '/(panel)/inspecoes', matchPaths: ['/inspecoes'] },
  { key: 'mapas', label: 'Mapa', icon: 'map-pin', route: '/(panel)/mapas', matchPaths: ['/mapas'] },
  { key: 'formularios', label: 'Formulários', icon: 'edit-3', route: '/(panel)/admin/form-editor', matchPaths: ['/admin/form-editor', '/admin/editor-perguntas'] },
  { key: 'modulos', label: 'Módulos', icon: 'grid', route: '/(panel)/modulos', matchPaths: ['/modulos'] },
];

const NAVBAR_VISIBLE_PATHS = [
  '/dashboard', '/inspecoes', '/perfil', '/modulos', '/mapas',
  '/admin', '/supervisor', '/master', '/admin/relatorios', '/admin/estatisticas', '/admin/form-editor', '/admin/editor-perguntas',
];

interface BottomNavBarInnerProps {
  role: string;
  pathname: string;
}

export const BottomNavBarInner = React.memo(function BottomNavBarInner({ role, pathname }: BottomNavBarInnerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const normalizedPath = pathname.replace(/\/+$/, '');
  const shouldShow = NAVBAR_VISIBLE_PATHS.some(path => normalizedPath === path || normalizedPath.endsWith(path));

  if (!shouldShow) return null;

  const tabs = role === 'master_admin'
    ? TABS_MASTER
    : role === 'admin'
      ? TABS_ADMIN
      : role === 'supervisor'
        ? TABS_SUPERVISOR
        : TABS_AGENT;

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
  const pathname = usePathname();
  if (!profile) return null;
  return <BottomNavBarInner role={profile.role} pathname={pathname} />;
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
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  labelActive: { fontWeight: FontWeight.bold },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
