import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface NavTab {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  route: string;
  matchPaths?: string[];
}

const TABS_AGENT: NavTab[] = [
  { key: 'home',     label: 'Início',   icon: 'home',      route: '/(panel)/dashboard',  matchPaths: ['/dashboard'] },
  { key: 'inspecoes',label: 'Vistorias',icon: 'clipboard', route: '/(panel)/inspecoes',  matchPaths: ['/inspecoes'] },
  { key: 'mapas',    label: 'Mapa',     icon: 'map',       route: '/(panel)/mapas',      matchPaths: ['/mapas'] },
  { key: 'perfil',   label: 'Perfil',   icon: 'user',      route: '/(panel)/perfil',     matchPaths: ['/perfil'] },
];

const TABS_SUPERVISOR: NavTab[] = [
  { key: 'home',     label: 'Início',   icon: 'home',      route: '/(panel)/supervisor', matchPaths: ['/supervisor'] },
  { key: 'inspecoes',label: 'Vistorias',icon: 'clipboard', route: '/(panel)/inspecoes',  matchPaths: ['/inspecoes'] },
  { key: 'mapas',    label: 'Mapa',     icon: 'map',       route: '/(panel)/mapas',      matchPaths: ['/mapas'] },
  { key: 'perfil',   label: 'Perfil',   icon: 'user',      route: '/(panel)/perfil',     matchPaths: ['/perfil'] },
];

const TABS_ADMIN: NavTab[] = [
  { key: 'home',      label: 'Início',    icon: 'home',        route: '/(panel)/admin',           matchPaths: ['/admin'] },
  { key: 'mapas',     label: 'Mapa',      icon: 'map',         route: '/(panel)/mapas',           matchPaths: ['/mapas'] },
  { key: 'relatorios',label: 'Relatórios',icon: 'bar-chart-2', route: '/(panel)/admin/relatorios', matchPaths: ['/admin/relatorios'] },
  { key: 'perfil',    label: 'Perfil',    icon: 'user',        route: '/(panel)/perfil',          matchPaths: ['/perfil'] },
];

const TABS_MASTER: NavTab[] = [
  { key: 'home',  label: 'Início', icon: 'home',    route: '/(panel)/master', matchPaths: ['/master'] },
  { key: 'mapas', label: 'Mapa',   icon: 'map',     route: '/(panel)/mapas',  matchPaths: ['/mapas'] },
  { key: 'perfil',label: 'Perfil', icon: 'user',    route: '/(panel)/perfil', matchPaths: ['/perfil'] },
];

const NAVBAR_VISIBLE_PATHS = [
  '/dashboard', '/inspecoes', '/mapas', '/perfil',
  '/admin', '/supervisor', '/master',
  '/admin/relatorios', '/admin/estatisticas',
];

interface BottomNavBarInnerProps {
  role: string;
  pathname: string;
}

export const BottomNavBarInner = React.memo(function BottomNavBarInner({ role, pathname }: BottomNavBarInnerProps) {
  const { theme } = useTheme();

  const shouldShow = NAVBAR_VISIBLE_PATHS.some(p => {
    const norm = pathname.replace(/\/+$/, '');
    return norm === p || norm.endsWith(p);
  });

  if (!shouldShow) return null;

  let tabs: NavTab[];
  switch (role) {
    case 'master_admin': tabs = TABS_MASTER; break;
    case 'admin':        tabs = TABS_ADMIN; break;
    case 'supervisor':   tabs = TABS_SUPERVISOR; break;
    default:             tabs = TABS_AGENT;
  }

  const isActive = (tab: NavTab) => {
    const norm = pathname.replace(/\/+$/, '');
    return (tab.matchPaths ?? [tab.route]).some(p => norm === p || norm.endsWith(p));
  };

  return (
    <View style={[styles.container, {
      backgroundColor: theme.surfaceHighlight,
      borderTopColor: theme.border,
    }]}>
      {tabs.map(tab => {
        const active = isActive(tab);
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
          >
            {/* Indicador topo */}
            <View style={[styles.topBar, active && { backgroundColor: theme.primary }]} />

            {/* Ícone com fundo ao ativar */}
            <View style={[
              styles.iconPill,
              active && { backgroundColor: `${theme.primary}18` },
            ]}>
              <Feather
                name={tab.icon}
                size={active ? 23 : 21}
                color={active ? theme.primary : theme.textSecondary}
              />
            </View>

            {/* Label */}
            <Text style={[
              styles.label,
              { color: active ? theme.primary : theme.textSecondary },
              active && styles.labelActive,
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 0,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  topBar: {
    width: 28,
    height: 3,
    borderRadius: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    marginBottom: 6,
    backgroundColor: 'transparent',
  },
  iconPill: {
    width: 46,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '700',
  },
});

export function BottomNavBar() {
  const { profile } = useAuth();
  const pathname = usePathname();

  if (!profile) return null;

  return <BottomNavBarInner role={profile.role} pathname={pathname} />;
}
