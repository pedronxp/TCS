import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSessionGuard } from '../context/SessionGuardContext';

export function SessionLockScreen() {
  const { theme } = useTheme();
  const { unlock } = useSessionGuard();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}15` }]}>
        <Feather name="lock" size={48} color={theme.primary} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Sessão bloqueada</Text>
      <Text style={[styles.desc, { color: theme.textSecondary }]}>
        Por segurança, sua sessão foi bloqueada após{'\n'}período de inatividade.
      </Text>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: theme.primary }]}
        onPress={unlock}
        activeOpacity={0.85}
      >
        <Feather name="unlock" size={18} color="#FFF" />
        <Text style={styles.btnText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  desc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
