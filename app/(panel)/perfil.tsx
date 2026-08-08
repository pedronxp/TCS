import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeMode, useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { supabase } from '../../utils/supabase';
import { AppHeader, Badge, StateBanner } from '../../components/ui';
import { useBottomTabPadding } from '../../utils/useBottomTabPadding';
import {
  linkCustomerGoogleIdentity,
  requestCustomerPasswordRecovery,
  translateCustomerIdentityError,
} from '../../services/CustomerAuthService';

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agente de Campo',
  supervisor: 'Supervisor',
  admin: 'Administrador',
  master_admin: 'Master Admin',
  owner: 'Responsável pela conta',
};

const THEME_OPTIONS: {
  value: ThemeMode;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}[] = [
  { value: 'system', label: 'Sistema', icon: 'smartphone' },
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Escuro', icon: 'moon' },
];

function formatarTelefone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone;
}

function normalizarTelefone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let local = digits;
  if (digits.startsWith('55') && digits.length > 11) local = digits.slice(2);
  if (local.length < 10 || local.length > 11) return null;
  return `+55${local}`;
}

export default function PerfilScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const {
    session,
    profile: authProfile,
    loading: authLoading,
    localTestMode,
    developerMode,
    signOut,
    refreshProfile,
  } = useAuth();
  const { isOnlineReal } = useConnectivity();

  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(authProfile?.name || '');
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [lgpdExpanded, setLgpdExpanded] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [googleLinking, setGoogleLinking] = useState(false);
  const [googleLinkedLocally, setGoogleLinkedLocally] = useState(false);

  useEffect(() => {
    setNewName(authProfile?.name || '');
  }, [authProfile?.name]);

  const saveName = async () => {
    if (!newName.trim() || !authProfile) return;
    if (localTestMode) {
      Alert.alert('Modo de teste', 'O perfil da conta de testes não pode ser alterado.');
      setEditingName(false);
      setNewName(authProfile.name);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: newName.trim() })
        .eq('uid', authProfile.uid);
      if (error) throw error;
      await refreshProfile();
      setEditingName(false);
    } catch {
      Alert.alert('Não foi possível salvar', 'Confira sua conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const savePhone = async () => {
    if (!authProfile) return;
    if (localTestMode) {
      Alert.alert('Modo de teste', 'Dados de contato não são alterados na conta de testes.');
      setEditingPhone(false);
      setPhoneInput('');
      return;
    }
    const normalized = normalizarTelefone(phoneInput);
    if (!normalized) {
      Alert.alert('Número inválido', 'Informe um número brasileiro com DDD.');
      return;
    }
    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ phone: normalized })
        .eq('uid', authProfile.uid);
      if (error) throw error;
      await refreshProfile();
      setEditingPhone(false);
      setPhoneInput('');
    } catch {
      Alert.alert('Não foi possível salvar', 'Confira sua conexão e tente novamente.');
    } finally {
      setSavingPhone(false);
    }
  };

  const resetPassword = async () => {
    if (!authProfile?.email || resetLoading) return;
    setResetLoading(true);
    try {
      await requestCustomerPasswordRecovery(authProfile.email);
      setResetSent(true);
    } catch {
      Alert.alert('E-mail não enviado', 'Não foi possível enviar o link agora. Tente novamente.');
    } finally {
      setResetLoading(false);
    }
  };

  const linkGoogle = async () => {
    if (googleLinking) return;
    setGoogleLinking(true);
    try {
      const result = await linkCustomerGoogleIdentity();
      if (result === 'completed' || result === 'already-linked') {
        setGoogleLinkedLocally(true);
        Alert.alert('Conta Google vinculada', 'Você poderá usar o Google neste mesmo acesso.');
      }
    } catch (cause) {
      Alert.alert('Não foi possível vincular', translateCustomerIdentityError(cause));
    } finally {
      setGoogleLinking(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Encerrar sessão?', 'Você precisará entrar novamente para acessar o aplicativo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => signOut() },
    ]);
  };

  if (authLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const initial = authProfile?.name?.[0]?.toUpperCase() || '?';
  const roleLabel = developerMode
    ? 'Desenvolvedor'
    : ROLE_LABELS[authProfile?.role ?? ''] || authProfile?.role || 'Usuário';
  const roleBadgeVariant = authProfile?.role === 'admin'
    ? 'error'
    : authProfile?.role === 'agent'
      ? 'success'
      : 'warning';
  const hasPhone = Boolean(authProfile?.phone);
  const phoneDisplay = hasPhone ? formatarTelefone(authProfile!.phone!) : null;
  const googleLinked = googleLinkedLocally
    || (session?.user.identities?.some(identity => identity.provider === 'google') ?? false);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Minha conta"
          onBack={() => router.back()}
          actionIcon="help-circle"
          actionLabel="Abrir suporte"
          onAction={() => router.push('/(panel)/suporte')}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={[styles.avatarText, { color: theme.onPrimary }]}>{initial}</Text>
          </View>

          <View style={styles.profileContent}>
            {editingName ? (
              <View style={styles.editRow}>
                <TextInput
                  style={[
                    styles.nameInput,
                    { color: theme.text, borderColor: theme.primary, backgroundColor: theme.background },
                  ]}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Seu nome"
                  placeholderTextColor={theme.textSecondary}
                  autoFocus
                />
                <TouchableOpacity
                  accessibilityLabel="Salvar nome"
                  style={[styles.smallButton, { backgroundColor: theme.primary }]}
                  onPress={saveName}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color={theme.onPrimary} />
                    : <Feather name="check" size={18} color={theme.onPrimary} />}
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="Cancelar edição"
                  style={[styles.smallButton, { borderColor: theme.border, borderWidth: 1 }]}
                  onPress={() => {
                    setEditingName(false);
                    setNewName(authProfile?.name || '');
                  }}
                >
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Editar nome"
                style={styles.nameRow}
                onPress={() => setEditingName(true)}
              >
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {authProfile?.name || 'Nome não definido'}
                </Text>
                <Feather name="edit-2" size={14} color={theme.textSecondary} />
              </TouchableOpacity>
            )}

            <Text style={[styles.email, { color: theme.textSecondary }]} numberOfLines={1}>
              {authProfile?.email || 'E-mail não informado'}
            </Text>

            <View style={styles.profileMeta}>
              <Badge variant={roleBadgeVariant} label={roleLabel} />
              {authProfile?.municipio ? (
                <Text style={[styles.municipality, { color: theme.textSecondary }]} numberOfLines={1}>
                  {authProfile.municipio}
                </Text>
              ) : null}
            </View>
          </View>

          <View
            accessibilityLabel={authProfile?.isApproved ? 'Conta ativa' : 'Conta pendente'}
            style={[
              styles.statusDot,
              { backgroundColor: authProfile?.isApproved ? theme.success : theme.warning },
            ]}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Acesso e segurança</Text>
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          {editingPhone ? (
            <View style={styles.phoneEditor}>
              <Text style={[styles.editorLabel, { color: theme.text }]}>WhatsApp</Text>
              <View style={styles.editRow}>
                <TextInput
                  style={[
                    styles.nameInput,
                    { color: theme.text, borderColor: theme.primary, backgroundColor: theme.background },
                  ]}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  placeholder="(11) 98765-4321"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                  maxLength={16}
                  autoFocus
                />
                <TouchableOpacity
                  accessibilityLabel="Salvar WhatsApp"
                  style={[styles.smallButton, { backgroundColor: theme.primary }]}
                  onPress={savePhone}
                  disabled={savingPhone}
                >
                  {savingPhone
                    ? <ActivityIndicator size="small" color={theme.onPrimary} />
                    : <Feather name="check" size={18} color={theme.onPrimary} />}
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="Cancelar edição"
                  style={[styles.smallButton, { borderColor: theme.border, borderWidth: 1 }]}
                  onPress={() => {
                    setEditingPhone(false);
                    setPhoneInput('');
                  }}
                >
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <SettingsRow
              icon="message-circle"
              title="WhatsApp"
              description={phoneDisplay || 'Adicionar número'}
              onPress={() => {
                setPhoneInput(phoneDisplay || '');
                setEditingPhone(true);
              }}
              theme={theme}
            />
          )}

          <Divider color={theme.border} />

          <SettingsRow
            icon="lock"
            title="Senha"
            description={resetSent ? 'Link enviado por e-mail' : 'Enviar link de redefinição'}
            onPress={resetPassword}
            loading={resetLoading}
            disabled={resetLoading || resetSent}
            theme={theme}
          />

          <Divider color={theme.border} />

          <SettingsRow
            icon={googleLinked ? 'check-circle' : 'link-2'}
            title="Conta Google"
            description={
              googleLinked
                ? 'Vinculada'
                : !isOnlineReal
                  ? 'Sem conexão'
                  : 'Vincular a este acesso'
            }
            onPress={linkGoogle}
            loading={googleLinking}
            disabled={googleLinked || googleLinking || !isOnlineReal || localTestMode}
            success={googleLinked}
            theme={theme}
          />
        </View>

        {resetSent ? (
          <StateBanner
            variant="success"
            title="Link enviado"
            description="Abra o e-mail para criar uma nova senha."
          />
        ) : null}

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Preferências</Text>
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={styles.themeBlock}>
            <View style={styles.themeHeading}>
              <View style={[styles.rowIcon, { backgroundColor: `${theme.primary}14` }]}>
                <Feather name="sun" size={18} color={theme.primary} />
              </View>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Aparência</Text>
            </View>
            <View
              accessibilityRole="radiogroup"
              style={[styles.themeOptions, { backgroundColor: theme.background }]}
            >
              {THEME_OPTIONS.map(option => {
                const selected = themeMode === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityLabel={`Tema ${option.label}`}
                    accessibilityState={{ selected }}
                    style={[
                      styles.themeOption,
                      selected && { backgroundColor: theme.surface, borderColor: theme.cardBorder },
                    ]}
                    onPress={() => setThemeMode(option.value)}
                  >
                    <Feather
                      name={option.icon}
                      size={15}
                      color={selected ? theme.primary : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.themeOptionText,
                        { color: selected ? theme.primary : theme.textSecondary },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Divider color={theme.border} />

          <SettingsRow
            icon="shield"
            title="Privacidade e LGPD"
            description="Como seus dados são protegidos"
            onPress={() => setLgpdExpanded(value => !value)}
            trailingIcon={lgpdExpanded ? 'chevron-up' : 'chevron-down'}
            theme={theme}
          />

          <Divider color={theme.border} />

          <SettingsRow
            icon="help-circle"
            title="Ajuda e suporte"
            description="Fale com a equipe TCS"
            onPress={() => router.push('/(panel)/suporte')}
            theme={theme}
          />
        </View>

        {lgpdExpanded ? (
          <View style={[styles.privacyCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <Text style={[styles.privacyTitle, { color: theme.text }]}>Seus dados no TCS</Text>
            <Text style={[styles.privacyText, { color: theme.textSecondary }]}>
              Usamos dados de identificação, contato, localização e evidências somente para autenticação,
              vistorias e comunicação operacional da Defesa Civil.
            </Text>
            <View style={[styles.privacyNotice, { backgroundColor: theme.successLight }]}>
              <Feather name="check-circle" size={16} color={theme.success} />
              <Text style={[styles.privacyNoticeText, { color: theme.success }]}>
                Nenhum dado pessoal é vendido. Você pode solicitar correção ou exclusão pelo suporte.
              </Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Encerrar sessão"
          activeOpacity={0.8}
          style={[styles.logoutButton, { borderColor: `${theme.error}55` }]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={18} color={theme.error} />
          <Text style={[styles.logoutText, { color: theme.error }]}>Encerrar sessão</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function SettingsRow({
  icon,
  title,
  description,
  onPress,
  theme,
  disabled = false,
  loading = false,
  success = false,
  trailingIcon = 'chevron-right',
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description: string;
  onPress: () => void;
  theme: any;
  disabled?: boolean;
  loading?: boolean;
  success?: boolean;
  trailingIcon?: React.ComponentProps<typeof Feather>['name'];
}) {
  const accent = success ? theme.success : theme.primary;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      accessibilityState={{ disabled }}
      activeOpacity={0.75}
      disabled={disabled}
      style={[styles.settingsRow, disabled && !success && styles.disabledRow]}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${accent}14` }]}>
        {loading
          ? <ActivityIndicator size="small" color={accent} />
          : <Feather name={icon} size={18} color={accent} />}
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: success ? theme.success : theme.text }]}>{title}</Text>
        <Text style={[styles.rowDescription, { color: theme.textSecondary }]}>{description}</Text>
      </View>
      {!loading && !success ? <Feather name={trailingIcon} size={18} color={theme.textSecondary} /> : null}
    </TouchableOpacity>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },

  profileCard: {
    minHeight: 112,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { fontSize: 24, fontWeight: '800' },
  profileContent: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  name: { flexShrink: 1, fontSize: 19, lineHeight: 24, fontWeight: '700' },
  email: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  profileMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  municipality: { flexShrink: 1, fontSize: 11, fontWeight: '600' },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 10, alignSelf: 'flex-start' },

  sectionTitle: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 9,
    marginLeft: 2,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
  },
  settingsRow: {
    minHeight: 72,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledRow: { opacity: 0.55 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  rowDescription: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 67 },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: {
    flex: 1,
    minWidth: 0,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  smallButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneEditor: { padding: 15 },
  editorLabel: { fontSize: 13, fontWeight: '700', marginBottom: 9 },

  themeBlock: { paddingHorizontal: 15, paddingTop: 13, paddingBottom: 15 },
  themeHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  themeOptions: { flexDirection: 'row', borderRadius: 13, padding: 4, gap: 4 },
  themeOption: {
    flex: 1,
    minHeight: 39,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  themeOptionText: { fontSize: 11, fontWeight: '700' },

  privacyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginTop: -14,
    marginBottom: 24,
  },
  privacyTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  privacyText: { fontSize: 12, lineHeight: 19 },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 11,
    marginTop: 13,
  },
  privacyNoticeText: { flex: 1, fontSize: 11, lineHeight: 17, fontWeight: '600' },

  logoutButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 2,
  },
  logoutText: { fontSize: 14, fontWeight: '700' },
});
