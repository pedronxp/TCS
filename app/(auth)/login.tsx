import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { traduzirErroAuth } from '../../utils/authErrors';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui';
import { recordLoginAttempt, getLoginBlockedUntil, clearLoginAttempts } from '../../utils/loginRateLimit';
import { registrarAuditoria } from '../../utils/auditLogger';

type Modo = 'email' | 'whatsapp';

const formatarTelefone = (t: string) => {
  const d = t.replace(/\D/g, '').substring(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export default function LoginScreen() {
  const { theme } = useTheme();

  // ── Modo ─────────────────────────────────────────────────────────────────
  const [modo, setModo] = useState<Modo>('email');

  // ── E-mail ────────────────────────────────────────────────────────────────
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  const [telefone, setTelefone]   = useState('');
  const [otp, setOtp]             = useState('');
  const [otpEnviado, setOtpEnviado] = useState(false);

  // ── Geral ─────────────────────────────────────────────────────────────────
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Login por e-mail
  // ─────────────────────────────────────────────────────────────────────────
  const handleLoginEmail = async () => {
    if (!email || !password) { setError('Preencha todos os campos.'); return; }

    const emailNorm = email.trim().toLowerCase();
    const blockedUntil = await getLoginBlockedUntil(emailNorm);
    if (blockedUntil) {
      const min = Math.ceil((blockedUntil - Date.now()) / 60000);
      setError(`Acesso bloqueado por excesso de tentativas. Tente novamente em ${min} min.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: emailNorm, password });
      if (authError) {
        await recordLoginAttempt(emailNorm);
        registrarAuditoria({ acao: 'login_falhou', adminUid: emailNorm, adminNome: emailNorm, municipio: '', detalhes: { motivo: authError.message } });
        throw authError;
      }

      const { data: userData, error: userError } = await supabase.from('users').select('isApproved').eq('email', emailNorm).single();
      if (userError || !userData?.isApproved) {
        await supabase.auth.signOut();
        await recordLoginAttempt(emailNorm);
        registrarAuditoria({ acao: 'login_falhou', adminUid: data?.user?.id || emailNorm, adminNome: emailNorm, municipio: '', detalhes: { motivo: 'conta_nao_aprovada' } });
        throw new Error('Conta aguardando aprovação do administrador.');
      }
      await clearLoginAttempts(emailNorm);
    } catch (e: any) {
      setError(traduzirErroAuth(e.message) || 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // WhatsApp — enviar OTP
  // ─────────────────────────────────────────────────────────────────────────
  const handleEnviarOTP = async () => {
    const digitos = telefone.replace(/\D/g, '');
    if (digitos.length < 10) { setError('Informe um número de WhatsApp válido com DDD.'); return; }
    setLoading(true);
    setError(null);
    try {
      const fone = `+55${digitos}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({ phone: fone });
      if (otpError) throw otpError;
      setOtpEnviado(true);
    } catch (e: any) {
      setError('Não foi possível enviar o código. Verifique o número e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // WhatsApp — verificar OTP
  // ─────────────────────────────────────────────────────────────────────────
  const handleVerificarOTP = async () => {
    if (otp.length < 6) { setError('Insira o código de 6 dígitos recebido.'); return; }
    setLoading(true);
    setError(null);
    try {
      const fone = `+55${telefone.replace(/\D/g, '')}`;
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone: fone, token: otp, type: 'sms' });
      if (verifyError) throw verifyError;
    } catch (e: any) {
      setError('Código inválido ou expirado. Solicite um novo código.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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

          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.text }]}>Autenticação</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Escolha como deseja acessar o sistema.
            </Text>
          </View>

          {/* Tabs de modo */}
          <View style={[styles.tabRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            {/* E-mail */}
            <TouchableOpacity
              style={[styles.tab, modo === 'email' && { backgroundColor: theme.primary, borderRadius: 10 }]}
              onPress={() => { setModo('email'); setError(null); setOtpEnviado(false); }}
            >
              <Feather name="mail" size={15} color={modo === 'email' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.tabText, { color: modo === 'email' ? '#FFF' : theme.textSecondary }]}>
                E-mail
              </Text>
            </TouchableOpacity>

            {/* WhatsApp — em manutenção */}
            <TouchableOpacity style={[styles.tab, { opacity: 0.45 }]} disabled>
              <Feather name="message-circle" size={15} color={theme.textSecondary} />
              <Text style={[styles.tabText, { color: theme.textSecondary }]}>WhatsApp</Text>
              <View style={styles.manutencaoBadge}>
                <Text style={styles.manutencaoText}>Manutenção</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Form E-mail ── */}
          {modo === 'email' && (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>E-mail</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                  <Feather name="mail" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="nome@email.com"
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
                    secureTextEntry={!showPwd}
                  />
                  <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={styles.eyeIcon}>
                    <Feather name={showPwd ? 'eye-off' : 'eye'} color={theme.textSecondary} size={20} />
                  </TouchableOpacity>
                </View>
              </View>

              {error && <ErrorBox msg={error} />}

              <Button variant="primary" loading={loading} onPress={handleLoginEmail} disabled={loading}>
                Entrar no Sistema
              </Button>

              <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={[styles.linkText, { color: theme.textSecondary }]}>Recuperar credenciais</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/(auth)/register')}>
                <Text style={[styles.linkText, { color: theme.primary }]}>Validar Token de Acesso</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Form WhatsApp ── */}
          {modo === 'whatsapp' && (
            <View style={styles.form}>
              {!otpEnviado ? (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Número do WhatsApp</Text>
                    <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                      <View style={[styles.ddiChip, { borderColor: theme.border }]}>
                        <Text style={[styles.ddiText, { color: theme.text }]}>🇧🇷 +55</Text>
                      </View>
                      <TextInput
                        style={[styles.input, { color: theme.text }]}
                        placeholder="(11) 99999-9999"
                        placeholderTextColor={theme.textSecondary}
                        value={telefone}
                        onChangeText={t => setTelefone(formatarTelefone(t))}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  <View style={[styles.infoBox, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}25` }]}>
                    <Feather name="info" size={14} color={theme.primary} />
                    <Text style={[styles.infoText, { color: theme.primary }]}>
                      Você receberá um código de 6 dígitos via SMS/WhatsApp.
                    </Text>
                  </View>

                  {error && <ErrorBox msg={error} />}

                  <Button variant="primary" loading={loading} onPress={handleEnviarOTP} disabled={loading}>
                    Enviar Código
                  </Button>
                </>
              ) : (
                <>
                  <View style={[styles.infoBox, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}>
                    <Feather name="check-circle" size={14} color="#10B981" />
                    <Text style={[styles.infoText, { color: '#10B981' }]}>
                      Código enviado para {telefone}
                    </Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Código de Verificação</Text>
                    <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                      <Feather name="shield" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { color: theme.text, letterSpacing: 6, fontSize: 20, fontWeight: '700' }]}
                        placeholder="000000"
                        placeholderTextColor={theme.textSecondary}
                        value={otp}
                        onChangeText={t => setOtp(t.replace(/\D/g, '').substring(0, 6))}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                  </View>

                  {error && <ErrorBox msg={error} />}

                  <Button variant="primary" loading={loading} onPress={handleVerificarOTP} disabled={loading || otp.length < 6}>
                    Verificar e Entrar
                  </Button>

                  <TouchableOpacity style={styles.linkBtn} onPress={() => { setOtpEnviado(false); setOtp(''); setError(null); }}>
                    <Text style={[styles.linkText, { color: theme.textSecondary }]}>Reenviar código</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/(auth)/register')}>
                <Text style={[styles.linkText, { color: theme.primary }]}>Validar Token de Acesso</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <View style={errorStyles.wrap}>
      <Feather name="alert-circle" size={16} color="#EF4444" />
      <Text style={errorStyles.text}>{msg}</Text>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)', borderRadius: 12,
    padding: 12, gap: 8,
  },
  text: { color: '#EF4444', fontSize: 14, flex: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 32, paddingTop: 20, paddingBottom: 40 },
  header: { height: 48, justifyContent: 'center', marginBottom: 20 },
  backButton: { width: 44, height: 44, justifyContent: 'center', borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  titleSection: { marginBottom: 28 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -1.0, lineHeight: 40 },
  subtitle: { fontSize: 15, fontWeight: '400', marginTop: 12, lineHeight: 22 },

  /* Tabs */
  tabRow: {
    flexDirection: 'row', borderRadius: 14, borderWidth: 1,
    padding: 4, gap: 4, marginBottom: 28,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  tabText: { fontSize: 13, fontWeight: '700' },

  form: { gap: 24 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1, height: 60, paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  eyeIcon: { padding: 8 },

  /* DDI chip */
  ddiChip: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 10,
  },
  ddiText: { fontSize: 13, fontWeight: '700' },

  /* Info box */
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderWidth: 1, borderRadius: 12, padding: 12,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },

  linkBtn: { alignItems: 'center' },
  linkText: { fontSize: 14, fontWeight: '500' },

  manutencaoBadge: {
    backgroundColor: '#F59E0B22', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, marginLeft: 2,
  },
  manutencaoText: { fontSize: 9, fontWeight: '700', color: '#F59E0B' },
});
