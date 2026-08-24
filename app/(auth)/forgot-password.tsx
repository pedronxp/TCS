import React, { useMemo, useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui';
import { TurnstileChallenge } from '../../components/TurnstileChallenge';
import { requestCustomerPasswordRecovery } from '../../services/CustomerAuthService';
import { getTurnstileConfiguration } from '../../services/TurnstileService';
import { TCSPalette } from '../../constants/Colors';

type Canal = 'email' | 'whatsapp';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const [canal, setCanal] = useState<Canal>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstile = useMemo(() => getTurnstileConfiguration(), []);

  const handleEnviar = async () => {
    if (!email.trim()) {
      setError('Informe o e-mail cadastrado.');
      return;
    }
    if (turnstile.enabled && !captchaToken) {
      setError('Conclua a verificação de segurança para solicitar a recuperação.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await requestCustomerPasswordRecovery(email, captchaToken);
      setSent(true);
    } catch (recoveryError: any) {
      if (recoveryError?.message === 'password_recovery_disabled') {
        setError('A recuperação de senha está temporariamente indisponível.');
      } else {
        // Resposta indistinguível para não revelar se a conta existe.
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={styles.sentContainer}>
          <Feather name="mail" size={48} color={theme.primary} />
          <Text style={[styles.title, { color: theme.text, textAlign: 'center' }]}>Confira seu e-mail</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary, textAlign: 'center' }]}>
            Se existir uma conta elegível, enviaremos um link seguro para redefinir a senha. O link expira e só pode ser usado uma vez.
          </Text>
          <Button variant="primary" onPress={() => router.replace('/(auth)/login')} style={{ width: '100%' }}>
            Voltar ao login
          </Button>
        </View>
      </SafeAreaView>
    );
  }

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
              Enviaremos um link seguro para você criar uma nova senha.
            </Text>
          </View>

          {/* Seletor de canal */}
          <View style={[styles.tabRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            {/* Email */}
            <TouchableOpacity
              style={[styles.tab, canal === 'email' && { backgroundColor: theme.primary, borderRadius: 10 }]}
              onPress={() => { setCanal('email'); setError(null); }}
            >
              <Feather name="mail" size={15} color={canal === 'email' ? theme.onPrimary : theme.textSecondary} />
              <Text style={[styles.tabText, { color: canal === 'email' ? theme.onPrimary : theme.textSecondary }]}>
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
              <View style={[styles.emBreve, { backgroundColor: theme.warningLight }]}>
                <Text style={[styles.emBreveText, { color: theme.warning }]}>Manutenção</Text>
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

            {turnstile.enabled ? (
              <TurnstileChallenge configuration={turnstile} onToken={setCaptchaToken} />
            ) : null}

            {error !== null && (
              <View style={[styles.errorBox, { backgroundColor: theme.errorLight, borderColor: theme.error }]}>
                <Feather name="alert-circle" size={16} color={theme.error} />
                <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
              </View>
            )}

            <Button variant="primary" loading={loading} onPress={handleEnviar} disabled={loading}>
              Enviar link de recuperação
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
  sentContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, paddingHorizontal: 32 },
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
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, marginLeft: 2,
  },
  emBreveText: { fontSize: 9, fontWeight: '700' },
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
    borderWidth: 1, borderRadius: 12, padding: 12, gap: 8,
  },
  errorText: { fontSize: 14, flex: 1 },
  linkBtn: { alignItems: 'center' },
  linkText: { fontSize: 14, fontWeight: '500' },
});
