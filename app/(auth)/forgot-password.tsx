import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from '../../utils/supabase';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const handleEnviar = async () => {
    if (!email.trim()) {
      setError('Informe o e-mail cadastrado.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: 'defesacivil://reset-password' }
      );

      // Supabase retorna sucesso mesmo se o e-mail não existir (segurança)
      if (resetError) throw resetError;

      setEnviado(true);
    } catch (e: any) {
      setError('Erro ao enviar. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Tela de confirmação após envio
  if (enviado) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={styles.confirmacaoContainer}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: (theme as any).successLight || '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Feather name="mail" size={36} color={theme.success} />
          </View>
          <Text style={[styles.confirmacaoTitulo, { color: theme.text }]}>Email enviado!</Text>
          <Text style={[styles.confirmacaoDesc, { color: theme.textSecondary }]}>
            Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
          </Text>
          <Button variant="secondary" onPress={() => router.back()} style={{ marginTop: 24 }}>
            Voltar ao Login
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
          contentContainerStyle={{ flexGrow: 1, padding: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                borderWidth: 1,
                backgroundColor: theme.iconBackground,
                borderColor: theme.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="arrow-left" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Título */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.text }]}>Recuperar Acesso</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Informe seu e-mail cadastrado. Enviaremos um link para redefinir sua senha.
            </Text>
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
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(239,68,68,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.2)',
                borderRadius: 12,
                padding: 12,
                gap: 8,
                marginBottom: 12,
              }}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontSize: 14, flex: 1 }}>{error}</Text>
              </View>
            )}

            <Button variant="primary" loading={loading} onPress={handleEnviar} disabled={loading}>
              Enviar Email de Recuperação
            </Button>

            <TouchableOpacity style={styles.voltarLink} onPress={() => router.back()}>
              <Text style={[styles.voltarText, { color: theme.textSecondary }]}>Lembrou a senha? Voltar ao login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { height: 48, justifyContent: 'center', marginBottom: 20 },
  titleSection: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -1.0, lineHeight: 40 },
  subtitle: { fontSize: 15, fontWeight: '400', marginTop: 12, lineHeight: 22 },
  form: { gap: 24 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, height: 60, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  voltarLink: { alignItems: 'center', marginTop: 8 },
  voltarText: { fontSize: 14, fontWeight: '500' },
  // Tela de confirmação
  confirmacaoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  confirmacaoTitulo: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 16 },
  confirmacaoDesc: { fontSize: 15, lineHeight: 24, textAlign: 'center', marginBottom: 8 },
});
