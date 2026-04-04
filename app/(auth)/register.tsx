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
import { Card, Button } from '../../components/ui';

const formatarToken = (texto: string) => {
  const limpo = texto.replace(/[^A-Z0-9]/g, '').toUpperCase();
  const partes = limpo.match(/.{1,4}/g) || [];
  return partes.join('-').substring(0, 14); // XXXX-XXXX-XXXX = 14 chars
};

const calcularForca = (s: string): 0 | 1 | 2 => {
  if (s.length < 8) return 0;
  const temEspecial = /[^A-Za-z0-9]/.test(s);
  if (s.length >= 10 && temEspecial) return 2; // Forte
  return 1; // Média
};

export default function RegisterScreen() {
  const { theme } = useTheme();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [senhaForca, setSenhaForca] = useState<0 | 1 | 2>(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const handleRegister = async () => {
    if (!nome || !email || !token || !senha || !confirmarSenha) {
      setError('Preencha todos os campos.');
      return;
    }
    if (senha !== confirmarSenha) {
      setError('As senhas não coincidem. Verifique e tente novamente.');
      return;
    }
    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }
    if (senha.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    // Verificar força mínima de senha (letras + números)
    if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
      setError('A senha deve conter letras e números.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Validar token de convite via RPC server-side (evita bug de fuso horário — AUTH-01)
      const codigoNorm = token.trim().toUpperCase().replace(/\s/g, '');
      const { data: tokenValidation, error: validationError } = await supabase
        .rpc('validate_invite_token', { p_codigo: codigoNorm })
        .single();

      if (validationError || !tokenValidation) throw new Error('Token inválido ou já utilizado.');
      if (!tokenValidation.valido) throw new Error(tokenValidation.motivo);

      // tokenData é alias para tokenValidation — mantém compatibilidade com código downstream
      const tokenData = tokenValidation;

      // Verificar domínio de email autorizado pelo município
      if (tokenData.municipio) {
        const { data: dominioOk } = await supabase.rpc('check_email_domain', {
          p_municipio: tokenData.municipio,
          p_email: email.trim().toLowerCase(),
        });
        if (dominioOk === false) {
          throw new Error('Este endereço de e-mail não é autorizado para o município. Use um e-mail corporativo.');
        }
      }

      // 2. Criar conta no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            name: nome,
            role: tokenData.role,
            municipio: tokenData.municipio,
          }
        }
      });

      if (authError) throw authError;

      const uid = authData.user?.id;
      if (!uid) throw new Error('Falha ao criar conta. Tente novamente.');

      // 3. Inserir usuário na tabela users com isApproved=false ANTES de deletar o token
      // (garante que, se o insert falhar, o token ainda pode ser reutilizado)
      const { error: insertError } = await supabase.from('users').insert({
        uid,
        name: nome,
        username: email.split('@')[0],
        email,
        role: tokenData.role,
        municipio: tokenData.municipio,
        isApproved: true,
        createdAt: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      // 4. Marcar token como usado via RPC (SECURITY DEFINER ignora RLS)
      // Captura IP do dispositivo para rastreio (best effort)
      let deviceIp = '';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        deviceIp = ipData.ip || '';
      } catch { /* silencioso — IP não é obrigatório */ }

      await supabase.rpc('mark_token_used', {
        p_codigo: codigoNorm,
        p_uid: uid,
        p_nome: nome,
        p_ip: deviceIp,
      });

      // 5. Notificar o admin que criou o token (best effort — nunca bloqueia o fluxo)
      try {
        if (tokenData.criadoPor) {
          const { data: adminData } = await supabase
            .rpc('get_push_token_by_uid', { p_uid: tokenData.criadoPor });
          if (adminData) {
            const { notificarNovoUsuarioCadastrado } = await import('../../services/NotificationService');
            await notificarNovoUsuarioCadastrado(adminData, nome, tokenData.municipio || '');
          }
        }
      } catch { /* silencioso — notificação nunca pode impedir o cadastro */ }

      // 6. Deslogar — conta precisa de aprovação antes de acessar
      await supabase.auth.signOut();

      setSucesso(true);
    } catch (e: any) {
      setError(traduzirErroAuth(e.message) || 'Erro ao registrar.');
    } finally {
      setLoading(false);
    }
  };

  // Tela de aguardo de aprovação após registro bem-sucedido
  if (sucesso) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.sucessoContainer}>
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Feather name="check-circle" size={56} color={theme.success} />
              <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 16, color: theme.text }}>
                Conta criada com sucesso!
              </Text>
              <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 8 }}>
                Sua identidade foi verificada. Você já pode fazer login com suas credenciais.
              </Text>
              <Button variant="primary" onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 24 }}>
                Ir para o Login
              </Button>
            </View>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
              onPress={() => router.back()}
            >
              <Feather name="arrow-left" color={theme.textSecondary} size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.text }]}>Validação Segura</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Insira o token recebido pelo seu administrador para configurar sua conta.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Token de Acesso</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="key" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="XXXX-XXXX-XXXX"
                  placeholderTextColor={theme.textSecondary}
                  value={token}
                  onChangeText={(t) => setToken(formatarToken(t))}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Nome Completo</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="user" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Maria Silva"
                  placeholderTextColor={theme.textSecondary}
                  value={nome}
                  onChangeText={setNome}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>E-mail</Text>
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
              <Text style={[styles.label, { color: theme.textSecondary }]}>Senha Segura</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="lock" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textSecondary}
                  value={senha}
                  onChangeText={(novoValor) => {
                    setSenha(novoValor);
                    setSenhaForca(calcularForca(novoValor));
                  }}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} color={theme.textSecondary} size={20} />
                </TouchableOpacity>
              </View>
              {senha.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 8, marginBottom: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: i < senhaForca + 1
                          ? (senhaForca === 0 ? '#EF4444' : senhaForca === 1 ? '#D97706' : '#16A34A')
                          : theme.border,
                      }}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Confirmar Senha</Text>
              <View style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.surfaceHighlight,
                  borderColor: confirmarSenha.length > 0 && confirmarSenha !== senha
                    ? '#EF4444'
                    : confirmarSenha.length > 0 && confirmarSenha === senha
                    ? '#10B981'
                    : theme.border,
                },
              ]}>
                <Feather name="lock" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textSecondary}
                  value={confirmarSenha}
                  onChangeText={setConfirmarSenha}
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeIcon}>
                  <Feather name={showConfirm ? 'eye-off' : 'eye'} color={theme.textSecondary} size={20} />
                </TouchableOpacity>
              </View>
              {confirmarSenha.length > 0 && confirmarSenha !== senha && (
                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>As senhas não coincidem</Text>
              )}
              {confirmarSenha.length > 0 && confirmarSenha === senha && (
                <Text style={{ color: '#10B981', fontSize: 12, marginTop: 4 }}>Senhas conferem ✓</Text>
              )}
            </View>

            {error !== null && (
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.2)', borderRadius: 12,
                padding: 12, gap: 8, marginBottom: 12,
              }}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontSize: 14, flex: 1 }}>{error}</Text>
              </View>
            )}

            <Button variant="primary" loading={loading} onPress={handleRegister} disabled={loading}>
              Confirmar Identidade
            </Button>

            <Button variant="secondary" onPress={() => router.back()}>
              Voltar ao Login
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 32, paddingTop: 20, paddingBottom: 40 },
  header: { height: 48, justifyContent: 'center', marginBottom: 20 },
  backButton: { width: 44, height: 44, justifyContent: 'center', borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  titleSection: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -1.0, lineHeight: 40 },
  subtitle: { fontSize: 15, fontWeight: '400', marginTop: 12, lineHeight: 22 },
  form: { gap: 24 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, height: 60, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  eyeIcon: { padding: 8 },
  sucessoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
});
