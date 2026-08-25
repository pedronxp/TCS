import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { traduzirErroAuth } from '../../utils/authErrors';
import { recordLoginAttempt, getLoginBlockedUntil, clearLoginAttempts } from '../../utils/loginRateLimit';
import { registrarAuditoria } from '../../utils/auditLogger';
import { GoogleMark, ProductIdentity } from '../../components/brand';
import { TurnstileChallenge } from '../../components/TurnstileChallenge';
import { Button, Card, FormField, StateBanner } from '../../components/ui';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { ComponentSize, Spacing, SpacingAlias } from '../../constants/Spacing';
import {
  getPublicAuthCapabilities,
  signInCustomerWithGoogle,
} from '../../services/CustomerAuthService';
import { isActiveInternalMobileStaff, isNeutralCustomerProfile } from '../../services/AppProfileService';
import { getTurnstileConfiguration } from '../../services/TurnstileService';
import { useConnectivity } from '../../context/ConnectivityContext';

export default function LoginScreen() {
  const { theme } = useTheme();
  const { isOnlineReal } = useConnectivity();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRevision, setCaptchaRevision] = useState(0);
  const turnstile = useMemo(() => getTurnstileConfiguration(), []);

  useEffect(() => {
    getPublicAuthCapabilities()
      .then(capabilities => setGoogleAvailable(capabilities.googleAuth))
      .catch(() => setGoogleAvailable(false));
  }, []);

  const handleGoogle = async () => {
    if (!isOnlineReal) {
      setError('O primeiro acesso com Google precisa de internet. Se esta conta já entrou antes, reabra o aplicativo para usar a sessão salva.');
      return;
    }
    setGoogleLoading(true);
    setError(null);
    try {
      const result = await signInCustomerWithGoogle();
      if (result === 'cancelled') {
        setError('A entrada com Google foi cancelada antes da confirmação.');
      }
    } catch (cause: any) {
      setError(traduzirErroAuth(cause?.message) || 'Não foi possível entrar com o Google. Tente novamente.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLoginEmail = async () => {
    if (!isOnlineReal) {
      setError('O login precisa de internet. Uma sessão já validada continua disponível offline ao reabrir o aplicativo.');
      return;
    }
    if (!email || !password) {
      setError('Preencha o e-mail e a senha para continuar.');
      return;
    }
    if (turnstile.enabled && !captchaToken) {
      setError('Conclua a verificação de segurança antes de continuar.');
      return;
    }

    const emailNorm = email.trim().toLowerCase();
    const blockedUntil = await getLoginBlockedUntil(emailNorm);
    if (blockedUntil) {
      const minutes = Math.ceil((blockedUntil - Date.now()) / 60000);
      setError(`Acesso temporariamente bloqueado. Tente novamente em ${minutes} min.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: emailNorm,
        password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });
      if (authError) {
        if (turnstile.enabled) {
          setCaptchaToken(null);
          setCaptchaRevision(value => value + 1);
        }
        await recordLoginAttempt(emailNorm);
        registrarAuditoria({
          acao: 'login_falhou',
          adminUid: emailNorm,
          adminNome: emailNorm,
          municipio: '',
          detalhes: { motivo: authError.message },
        });
        throw authError;
      }

      const [customerResult, staffResult] = await Promise.all([
        supabase.rpc('get_my_user_profile'),
        supabase.rpc('get_internal_staff_profile'),
      ]);
      const { data: userData, error: userError } = customerResult;
      const { data: staffData, error: staffError } = staffResult;
      const staff = staffData as { role?: string; status?: string } | null;
      const activeInternalStaff = isActiveInternalMobileStaff(staff);

      if (userError && !activeInternalStaff) {
        await supabase.auth.signOut();
        throw new Error('Não foi possível validar o perfil desta conta. Tente novamente.');
      }

      const isNeutralCustomer = isNeutralCustomerProfile(userData);

      // Staff ativo e autorizado sempre prevalece sobre um perfil municipal
      // legado. A validação usa apenas RPCs vinculados ao usuário autenticado.
      if (!userData && !activeInternalStaff) {
        if (staffError) {
          await supabase.auth.signOut();
          throw new Error('Não foi possível validar o perfil desta conta. Tente novamente.');
        }
        if (staff) {
          await supabase.auth.signOut();
          throw new Error('Esta conta não possui acesso operacional ao aplicativo.');
        }
      } else if (!activeInternalStaff && userData && !userData.isApproved && !isNeutralCustomer) {
        await supabase.auth.signOut();
        await recordLoginAttempt(emailNorm);
        registrarAuditoria({
          acao: 'login_falhou',
          adminUid: data?.user?.id || emailNorm,
          adminNome: emailNorm,
          municipio: '',
          detalhes: { motivo: 'conta_nao_aprovada' },
        });
        throw new Error('Conta aguardando aprovação do administrador.');
      }

      await clearLoginAttempts(emailNorm);
    } catch (cause: any) {
      setError(traduzirErroAuth(cause.message) || 'Não foi possível realizar o acesso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={() => router.back()}
              style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Feather name="arrow-left" size={20} color={theme.text} />
            </Pressable>
            <ProductIdentity variant="compact" />
          </View>

          <View style={styles.titleBlock}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>ACESSO SEGURO</Text>
            <Text style={[styles.title, { color: theme.text }]}>Entre na sua operação</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Use a credencial vinculada ao seu perfil ou organização.</Text>
          </View>

          <Card style={styles.formCard}>
            <View style={[styles.accessTabs, { backgroundColor: theme.secondary }]}>
              <View style={[styles.accessTab, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Feather name="mail" size={16} color={theme.primary} />
                <Text style={[styles.accessTabActive, { color: theme.text }]}>E-mail</Text>
              </View>
              <View style={[styles.accessTab, styles.accessTabDisabled]}>
                <Feather name="message-circle" size={16} color={theme.textSecondary} />
                <Text style={[styles.accessTabText, { color: theme.textSecondary }]}>WhatsApp</Text>
                <View style={[styles.soonBadge, { backgroundColor: theme.warningLight }]}>
                  <Text style={[styles.soonText, { color: theme.warning }]}>Em breve</Text>
                </View>
              </View>
            </View>

            <View style={styles.form}>
              <FormField
                label="E-mail"
                placeholder="nome@organizacao.com.br"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                required
              />

              <View style={styles.passwordField}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Senha <Text style={{ color: theme.error }}>*</Text></Text>
                <View style={[styles.passwordInput, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    accessibilityLabel="Senha"
                    style={[styles.passwordText, { color: theme.text }]}
                    placeholder="Digite sua senha"
                    placeholderTextColor={theme.muted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    onSubmitEditing={handleLoginEmail}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onPress={() => setShowPassword(value => !value)}
                    style={styles.passwordAction}
                  >
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={19} color={theme.textSecondary} />
                  </Pressable>
                </View>
              </View>

              {turnstile.enabled ? (
                <TurnstileChallenge
                  key={captchaRevision}
                  configuration={turnstile}
                  onToken={setCaptchaToken}
                />
              ) : null}

              {error ? <StateBanner title="Não foi possível entrar" description={error} variant="danger" /> : null}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
                disabled={loading || googleLoading}
                onPress={handleLoginEmail}
                iconRight={<Feather name="arrow-right" size={18} color={theme.onPrimary} />}
              >
                Entrar no sistema
              </Button>

              {googleAvailable ? (
                <>
                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                    <Text style={[styles.dividerText, { color: theme.textSecondary }]}>ou</Text>
                    <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                  </View>
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    loading={googleLoading}
                    disabled={googleLoading || loading}
                    onPress={handleGoogle}
                    iconLeft={<GoogleMark size={18} />}
                  >
                    Entrar ou criar com Google
                  </Button>
                </>
              ) : null}

              <View style={styles.linksGrid}>
                <Button variant="ghost" style={styles.linkButton} onPress={() => router.push('/(auth)/forgot-password')}>
                  Recuperar senha
                </Button>
                <Button variant="secondary" style={styles.linkButton} onPress={() => router.push('/(auth)/register')}>
                  Criar conta
                </Button>
              </View>
            </View>
          </Card>

          <View style={styles.securityNote}>
            <Feather name="lock" size={14} color={theme.textSecondary} />
            <Text style={[styles.securityText, { color: theme.textSecondary }]}>Sessão protegida e acesso controlado por perfil</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: Spacing[5], paddingTop: Spacing[3], paddingBottom: Spacing[8], gap: Spacing[6] },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing[4] },
  backButton: { width: 44, height: 44, borderRadius: SpacingAlias.radiusMd, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { gap: Spacing[2] },
  eyebrow: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 1.2 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: FontWeight.extrabold, letterSpacing: -1 },
  subtitle: { fontSize: FontSize.base, lineHeight: 21, maxWidth: 360 },
  formCard: { padding: Spacing[4], gap: Spacing[5] },
  accessTabs: { minHeight: 48, borderRadius: SpacingAlias.radiusMd, padding: 4, flexDirection: 'row', gap: 4 },
  accessTab: { flex: 1, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2], borderWidth: 1 },
  accessTabDisabled: { opacity: 0.72, borderColor: 'transparent' },
  accessTabActive: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  accessTabText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  soonBadge: { borderRadius: SpacingAlias.radiusFull, paddingHorizontal: 6, paddingVertical: 2 },
  soonText: { fontSize: 9, fontWeight: FontWeight.bold },
  form: { gap: Spacing[5] },
  passwordField: { gap: Spacing[2] },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  passwordInput: { minHeight: ComponentSize.input, borderRadius: SpacingAlias.radiusMd, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: Spacing[3] },
  passwordText: { flex: 1, fontSize: FontSize.base, paddingVertical: Spacing[2] },
  passwordAction: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  linksGrid: { flexDirection: 'row', gap: Spacing[3] },
  linkButton: { flex: 1 },
  securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2] },
  securityText: { fontSize: FontSize.xs, textAlign: 'center' },
});
