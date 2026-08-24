import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSessionGuard } from '../context/SessionGuardContext';

export function SessionLockScreen() {
  const { theme } = useTheme();
  const { signOut } = useAuth();
  const { unlock, biometricEnabled, biometricLabel } = useSessionGuard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoPrompted = useRef(false);

  const handleUnlock = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const authenticated = await unlock();
      if (!authenticated) {
        setError('Não foi possível confirmar sua identidade. Tente novamente ou entre com sua conta.');
      }
    } finally {
      setLoading(false);
    }
  }, [loading, unlock]);

  useEffect(() => {
    if (!biometricEnabled || autoPrompted.current) return;
    autoPrompted.current = true;
    void handleUnlock();
  }, [biometricEnabled, handleUnlock]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}15` }]}>
        <Feather name="lock" size={48} color={theme.primary} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Sessão protegida</Text>
      <Text style={[styles.desc, { color: theme.textSecondary }]}>
        {biometricEnabled
          ? `Confirme sua identidade com ${biometricLabel} para continuar.`
          : 'Sua sessão foi bloqueada por inatividade. Entre novamente para continuar com segurança.'}
      </Text>
      {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
      {biometricEnabled ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Desbloquear com ${biometricLabel}`}
          style={[styles.btn, { backgroundColor: theme.primary }]}
          onPress={() => void handleUnlock()}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="unlock" size={18} color="#FFF" />}
          <Text style={styles.btnText}>Usar {biometricLabel}</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Encerrar a sessão e entrar novamente"
        style={[styles.secondaryBtn, { borderColor: theme.border }]}
        onPress={() => void signOut()}
        disabled={loading}
      >
        <Text style={[styles.secondaryText, { color: theme.text }]}>Entrar novamente</Text>
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
  error: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
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
  secondaryBtn: { paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  secondaryText: { fontSize: 14, fontWeight: '600' },
});
