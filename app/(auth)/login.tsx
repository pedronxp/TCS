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
import { traduzirErroAuth } from '../../utils/authErrors';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui';

export default function LoginScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;

      // Verificar aprovação antes de liberar acesso (Regra 9 do AGENTS.md)
      // O roteamento para /(panel) é feito automaticamente pelo AuthContext
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('isApproved')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (userError || !userData || !userData.isApproved) {
        await supabase.auth.signOut();
        throw new Error('Conta aguardando aprovação do administrador.');
      }
    } catch (e: any) {
      setError(traduzirErroAuth(e.message) || 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
              onPress={() => router.back()}
            >
              <Feather name="arrow-left" color={theme.textSecondary} size={24} />
            </TouchableOpacity>
          </View>

          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.text }]}>Autenticação</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Insira suas credenciais corporativas.</Text>
          </View>

          {/* Form */}
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
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Senha de Acesso</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="lock" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Feather name={showPassword ? 'eye-off' : 'eye'} color={theme.textSecondary} size={20} />
                </TouchableOpacity>
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

            <Button
              variant="primary"
              loading={loading}
              onPress={handleLogin}
              disabled={loading}
            >
              Entrar no Sistema
            </Button>

            <TouchableOpacity style={[styles.forgotPassword, { marginTop: -12 }]} onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={[styles.forgotPasswordText, { color: theme.textSecondary }]}>Recuperar credenciais</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.registerButton, { marginTop: -12 }]} onPress={() => router.push('/(auth)/register')}>
              <Text style={[styles.registerText, { color: theme.primary }]}>Validar Token de Acesso</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.registerButton} onPress={() => router.push('/test-ui')}>
              <Text style={[styles.registerText, { color: theme.success }]}>🔧 Acessar UI Sandbox</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    height: 48,
    justifyContent: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  titleSection: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1.0,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    marginTop: 12,
    lineHeight: 22,
  },
  form: {
    gap: 24,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 60,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 8,
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  registerButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  registerText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
