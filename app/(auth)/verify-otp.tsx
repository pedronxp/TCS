import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui';
import { TCSPalette } from '../../constants/Colors';

const RESEND_TIMEOUT = 60;

export default function VerifyOtpScreen() {
  const { theme } = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(RESEND_TIMEOUT);
  const [reenviando, setReenviando] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Timer de reenvio
  useEffect(() => {
    if (segundos <= 0) return;
    const t = setTimeout(() => setSegundos(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  const handleVerificar = async () => {
    if (codigo.length < 6) {
      setError('Digite o código de 6 dígitos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email!,
        token: codigo,
        type: 'email',
      });

      if (verifyError) throw verifyError;

      router.replace('/(auth)/reset-password');
    } catch {
      setError('Código inválido ou expirado. Verifique e tente novamente.');
      setCodigo('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleReenviar = async () => {
    setReenviando(true);
    setError(null);
    try {
      await supabase.auth.signInWithOtp({ email: email!, options: { shouldCreateUser: false } });
      setSegundos(RESEND_TIMEOUT);
      setCodigo('');
    } catch {
      setError('Não foi possível reenviar. Tente novamente.');
    } finally {
      setReenviando(false);
    }
  };

  const emailMascarado = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 3)) + c)
    : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 32, paddingTop: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
            >
              <Feather name="arrow-left" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Ícone + Título */}
          <View style={styles.titleSection}>
            <View style={[styles.iconWrap, { backgroundColor: theme.secondary }]}>
              <Feather name="shield" size={28} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Verificação</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Enviamos um código de 6 dígitos para{'\n'}
              <Text style={{ color: theme.text, fontWeight: '600' }}>{emailMascarado}</Text>
            </Text>
          </View>

          {/* Input do código */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Código de Verificação</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="hash" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  ref={inputRef}
                  style={[styles.input, { color: theme.text, letterSpacing: 8, fontSize: 22, fontWeight: '700' }]}
                  placeholder="000000"
                  placeholderTextColor={theme.textSecondary}
                  value={codigo}
                  onChangeText={t => {
                    setCodigo(t.replace(/\D/g, '').substring(0, 6));
                    setError(null);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>
            </View>

            {error !== null && (
              <View style={[styles.errorBox, { backgroundColor: theme.errorLight, borderColor: theme.error }]}>
                <Feather name="alert-circle" size={16} color={theme.error} />
                <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
              </View>
            )}

            <Button
              variant="primary"
              loading={loading}
              onPress={handleVerificar}
              disabled={loading || codigo.length < 6}
            >
              Verificar Código
            </Button>

            {/* Reenviar */}
            <View style={styles.reenviarRow}>
              {segundos > 0 ? (
                <Text style={[styles.reenviarInfo, { color: theme.textSecondary }]}>
                  Reenviar código em{' '}
                  <Text style={{ color: theme.text, fontWeight: '600' }}>{segundos}s</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleReenviar} disabled={reenviando}>
                  <Text style={[styles.reenviarBtn, { color: theme.primary }]}>
                    {reenviando ? 'Enviando...' : 'Reenviar código'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace('/(auth)/forgot-password')}>
              <Text style={[styles.linkText, { color: theme.textSecondary }]}>
                Usar outro e-mail
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { height: 48, justifyContent: 'center', marginBottom: 20 },
  backButton: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  titleSection: { alignItems: 'center', marginBottom: 36 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -1.0, lineHeight: 40 },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  form: { gap: 24 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1, height: 60, paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, padding: 12, gap: 8,
  },
  errorText: { fontSize: 14, flex: 1 },
  reenviarRow: { alignItems: 'center' },
  reenviarInfo: { fontSize: 14 },
  reenviarBtn: { fontSize: 14, fontWeight: '600' },
  linkBtn: { alignItems: 'center' },
  linkText: { fontSize: 14, fontWeight: '500' },
});
