import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui';

type Canal = 'email' | 'whatsapp';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const [canal, setCanal] = useState<Canal>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnviar = async () => {
    if (!email.trim()) {
      setError('Informe o e-mail cadastrado.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      });

      // Sempre navega para verify-otp por segurança (não revela se email existe)
      if (otpError && otpError.message !== 'Signups not allowed for otp') {
        throw otpError;
      }

      router.push({
        pathname: '/(auth)/verify-otp',
        params: { email: email.trim().toLowerCase(), canal },
      });
    } catch {
      setError('Erro ao enviar o código. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

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

          {/* Título */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.text }]}>Recuperar Acesso</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Enviaremos um código de verificação para confirmar sua identidade.
            </Text>
          </View>

          {/* Seletor de canal */}
          <View style={[styles.tabRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            {/* Email */}
            <TouchableOpacity
              style={[styles.tab, canal === 'email' && { backgroundColor: theme.primary, borderRadius: 10 }]}
              onPress={() => { setCanal('email'); setError(null); }}
            >
              <Feather name="mail" size={15} color={canal === 'email' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.tabText, { color: canal === 'email' ? '#FFF' : theme.textSecondary }]}>
                E-mail
              </Text>
            </TouchableOpacity>

            {/* WhatsApp — bloqueado */}
            <TouchableOpacity
              style={[styles.tab, { opacity: 0.45 }]}
              disabled
            >
              <Feather name="message-circle" size={15} color={theme.textSecondary} />
              <Text style={[styles.tabText, { color: theme.textSecondary }]}>WhatsApp</Text>
              <View style={styles.emBreve}>
                <Text style={styles.emBreveText}>Manutenção</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Formulário */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>E-mail Institucional</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="mail" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="nome@sistema.com"
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoFocus
                />
              </View>
            </View>

            {error !== null && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button variant="primary" loading={loading} onPress={handleEnviar} disabled={loading}>
              Enviar Código
            </Button>

            <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
              <Text style={[styles.linkText, { color: theme.textSecondary }]}>
                Lembrou a senha? Voltar ao login
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
  titleSection: { marginBottom: 28 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -1.0, lineHeight: 40 },
  subtitle: { fontSize: 15, fontWeight: '400', marginTop: 12, lineHeight: 22 },
  tabRow: {
    flexDirection: 'row', borderRadius: 14, borderWidth: 1,
    padding: 4, gap: 4, marginBottom: 28,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  emBreve: {
    backgroundColor: '#F59E0B22', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, marginLeft: 2,
  },
  emBreveText: { fontSize: 9, fontWeight: '700', color: '#F59E0B' },
  form: { gap: 24 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1, height: 60, paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)', borderRadius: 12, padding: 12, gap: 8,
  },
  errorText: { color: '#EF4444', fontSize: 14, flex: 1 },
  linkBtn: { alignItems: 'center' },
  linkText: { fontSize: 14, fontWeight: '500' },
});
