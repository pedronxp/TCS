import React, { useEffect, useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui';
import { validarSenha, calcularForcaSenha, FORCA_LABELS, FORCA_CORES } from '../../utils/passwordValidation';
import {
  completeCustomerPasswordRecovery,
  hasValidPasswordRecoverySession,
} from '../../services/CustomerAuthService';

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [recoverySessionValid, setRecoverySessionValid] = useState<boolean | null>(null);

  const forca = calcularForcaSenha(novaSenha);
  const forcaLabel = FORCA_LABELS;
  const forcaCor = FORCA_CORES;

  useEffect(() => {
    hasValidPasswordRecoverySession().then((valid) => {
      setRecoverySessionValid(valid);
      if (!valid) setError('Este link de recuperação é inválido, expirou ou já foi utilizado.');
    });
  }, []);

  const handleRedefinir = async () => {
    const validacao = validarSenha(novaSenha);
    if (!validacao.valido) {
      setError(validacao.erro ?? 'Senha inválida.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await completeCustomerPasswordRecovery(novaSenha, revokeOtherSessions);
      setSucesso(true);
    } catch {
      setError('Erro ao redefinir a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (sucesso) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={styles.centeredContainer}>
          <View style={[styles.iconWrap, { backgroundColor: (theme as any).successLight || '#F0FDF4' }]}>
            <Feather name="check-circle" size={36} color={theme.success} />
          </View>
          <Text style={[styles.titulo, { color: theme.text }]}>Senha redefinida!</Text>
          <Text style={[styles.subtitulo, { color: theme.textSecondary }]}>
            Sua senha foi atualizada com sucesso. Faça login com a nova senha.
          </Text>
          <Button
            variant="primary"
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: 24, width: '100%' }}
          >
            Ir para o Login
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
            <Text style={[styles.titulo, { color: theme.text }]}>Nova Senha</Text>
            <Text style={[styles.subtitulo, { color: theme.textSecondary }]}>
              Crie uma senha forte com letras e números.
            </Text>
          </View>

          <View style={styles.form}>
            {/* Nova senha */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Nova Senha</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="lock" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor={theme.textSecondary}
                  value={novaSenha}
                  onChangeText={v => { setNovaSenha(v); setError(null); }}
                  secureTextEntry={!mostrarSenha}
                  autoFocus
                />
                <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)} style={styles.eyeBtn}>
                  <Feather name={mostrarSenha ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Barra de força */}
              {novaSenha.length > 0 && (
                <View style={styles.forcaRow}>
                  {[0, 1, 2].map(i => (
                    <View
                      key={i}
                      style={[
                        styles.forcaBarra,
                        { backgroundColor: i <= forca ? forcaCor[forca] : theme.border },
                      ]}
                    />
                  ))}
                  <Text style={[styles.forcaLabel, { color: forcaCor[forca] }]}>
                    {forcaLabel[forca]}
                  </Text>
                </View>
              )}
            </View>

            {/* Confirmar senha */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Confirmar Nova Senha</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="lock" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Repita a nova senha"
                  placeholderTextColor={theme.textSecondary}
                  value={confirmarSenha}
                  onChangeText={v => { setConfirmarSenha(v); setError(null); }}
                  secureTextEntry={!mostrarSenha}
                />
              </View>
            </View>

            {error !== null && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.revokeRow}
              onPress={() => setRevokeOtherSessions(value => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: revokeOtherSessions }}
            >
              <Feather
                name={revokeOtherSessions ? 'check-square' : 'square'}
                size={20}
                color={theme.primary}
              />
              <Text style={[styles.revokeText, { color: theme.textSecondary }]}>
                Encerrar minhas outras sessões após redefinir a senha
              </Text>
            </TouchableOpacity>

            <Button
              variant="primary"
              loading={loading}
              onPress={handleRedefinir}
              disabled={loading || recoverySessionValid !== true}
            >
              {loading ? 'Alterando senha...' : 'Redefinir Senha'}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  revokeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  revokeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  centeredContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40,
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  header: { height: 48, justifyContent: 'center', marginBottom: 20 },
  backButton: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  titleSection: { marginBottom: 36 },
  titulo: { fontSize: 32, fontWeight: '700', letterSpacing: -1.0, lineHeight: 40 },
  subtitulo: { fontSize: 15, lineHeight: 22, marginTop: 10 },
  form: { gap: 24 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1, height: 60, paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  eyeBtn: { padding: 4 },
  forcaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  forcaBarra: { flex: 1, height: 4, borderRadius: 2 },
  forcaLabel: { fontSize: 12, fontWeight: '600', minWidth: 36 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)', borderRadius: 12, padding: 12, gap: 8,
  },
  errorText: { color: '#EF4444', fontSize: 14, flex: 1 },
});
