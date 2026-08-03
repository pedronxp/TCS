import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Alert, Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Network from 'expo-network';
import { ThemeMode, useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { supabase } from '../../utils/supabase';
import { logger } from '../../utils/logger';
import { AppHeader, Badge, Card, ErrorState, MetricCard, StateBanner } from '../../components/ui';
import { formatarData, formatarDataHora } from '../../utils/htmlUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../utils/useBottomTabPadding';
import { getTrainingVistoriasByAgente } from '../../utils/database';
import {
  linkCustomerGoogleIdentity,
  requestCustomerPasswordRecovery,
  translateCustomerIdentityError,
} from '../../services/CustomerAuthService';

const ROLE_LABELS: Record<string, string> = {
  agent:        'Agente de Campo',
  supervisor:   'Supervisor',
  admin:        'Administrador',
  master_admin: 'Master Admin',
};

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { value: 'system', label: 'Sistema', icon: 'smartphone' },
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Escuro', icon: 'moon' },
];

// Formata número BR para exibição: +5511987654321 → (11) 98765-4321
function formatarTelefone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Remove DDI 55
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone;
}

// Valida e normaliza entrada do usuário para formato +55XXXXXXXXXXX
function normalizarTelefone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  // Aceita com ou sem DDI
  let local = digits;
  if (digits.startsWith('55') && digits.length > 11) local = digits.slice(2);
  if (local.length < 10 || local.length > 11) return null;
  return `+55${local}`;
}

export default function PerfilScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { session, profile: authProfile, loading: authLoading, localTestMode, developerMode, signOut, refreshProfile } = useAuth();
  const { isOnlineReal } = useConnectivity();

  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(authProfile?.name || '');

  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const [stats, setStats] = useState({ total: 0, altoRisco: 0, hoje: 0, semana: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [deviceIp, setDeviceIp] = useState<string>('');
  const [lgpdExpanded, setLgpdExpanded] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [googleLinking, setGoogleLinking] = useState(false);

  useEffect(() => {
    if (authProfile) {
      setNewName(authProfile.name || '');
      loadStats();
    }

    // IP local da rede (Wi-Fi/dados)
    Network.getIpAddressAsync()
      .then(ip => setDeviceIp(ip && ip !== '0.0.0.0' ? ip : 'Indisponível'))
      .catch(() => setDeviceIp('Indisponível'));
  }, [authProfile]);

  const loadStats = async () => {
    setStatsError(null);
    setStatsLoading(true);
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const semanaAtras = new Date(Date.now() - 7 * 24 * 3600000).toISOString();

      if (localTestMode && authProfile) {
        const locais = getTrainingVistoriasByAgente(authProfile.uid);
        setStats({
          total: locais.length,
          altoRisco: locais.filter(item => ['r3', 'r4'].includes(item.nivel_risco)).length,
          hoje: locais.filter(item => item.data_vistoria?.startsWith(hoje)).length,
          semana: locais.filter(item => new Date(item.data_vistoria).getTime() >= new Date(semanaAtras).getTime()).length,
        });
        return;
      }

      if (authProfile?.role === 'agent') {
        const uid = authProfile.uid;
        const [
          { count: total },
          { count: alto },
          { count: hojeCount },
          { count: semanaCount },
        ] = await Promise.all([
          supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid),
          supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid).in('nivelRisco', ['r3', 'r4']),
          supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid).gte('dataVistoria', `${hoje}T00:00:00.000Z`),
          supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', uid).gte('dataVistoria', semanaAtras),
        ]);
        setStats({ total: total || 0, altoRisco: alto || 0, hoje: hojeCount || 0, semana: semanaCount || 0 });
      } else if (authProfile?.role === 'supervisor' || authProfile?.role === 'admin') {
        const municipio = authProfile.municipio;
        const [{ count: total }, { count: alto }, { count: semana }] = await Promise.all([
          supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('municipio', municipio),
          supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('municipio', municipio).in('nivelRisco', ['r3', 'r4']),
          supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('municipio', municipio).gte('dataVistoria', semanaAtras),
        ]);
        setStats({ total: total || 0, altoRisco: alto || 0, hoje: 0, semana: semana || 0 });
      }
    } catch (e) {
      logger.error('system', 'Erro ao carregar stats', { erro: String(e) });
      setStatsError('Erro ao carregar estatísticas');
    } finally {
      setStatsLoading(false);
    }
  };

  const saveName = async () => {
    if (!newName.trim() || !authProfile) return;
    if (localTestMode) {
      Alert.alert('Modo de teste', 'O perfil da conta de testes é fixo e não será alterado no banco de dados.');
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
      Alert.alert('Nome atualizado', 'Seu nome foi alterado com sucesso.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o nome.');
    } finally {
      setSaving(false);
    }
  };

  const savePhone = async () => {
    if (!authProfile) return;
    if (localTestMode) {
      Alert.alert('Modo de teste', 'Dados de contato não são enviados ao banco pela conta de testes.');
      setEditingPhone(false);
      setPhoneInput('');
      return;
    }
    const normalized = normalizarTelefone(phoneInput);
    if (!normalized) {
      Alert.alert('Número inválido', 'Informe um número brasileiro válido com DDD.\nEx: (11) 98765-4321');
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
      Alert.alert('WhatsApp salvo', 'Número de WhatsApp cadastrado com sucesso.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o número.');
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
      Alert.alert('Erro', 'Não foi possível enviar o e-mail de redefinição. Tente novamente.');
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
        Alert.alert('Google vinculado', 'Sua conta Google foi vinculada sem alterar seu papel ou seus acessos.');
      }
    } catch (cause) {
      Alert.alert('Vínculo não concluído', translateCustomerIdentityError(cause));
    } finally {
      setGoogleLinking(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => { await signOut(); } },
    ]);
  };

  if (authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const initial = authProfile?.name?.[0]?.toUpperCase() || '?';
  const roleLabel = developerMode
    ? 'Desenvolvedor (acima da Master)'
    : ROLE_LABELS[authProfile?.role ?? ''] || authProfile?.role || '—';
  const isAgent = authProfile?.role === 'agent';
  const showStats = isAgent || authProfile?.role === 'supervisor' || authProfile?.role === 'admin';

  const roleBadgeVariant =
    authProfile?.role === 'agent' ? 'success' :
    authProfile?.role === 'admin' ? 'error' :
    'warning';

  const lastSignIn = session?.user?.last_sign_in_at;
  const lastAccessText = lastSignIn ? formatarDataHora(lastSignIn) : '—';
  const memberSinceText = authProfile?.createdAt ? formatarData(authProfile.createdAt) : '—';

  const hasPhone = !!authProfile?.phone;
  const phoneDisplay = hasPhone ? formatarTelefone(authProfile!.phone!) : null;
  const googleLinked = session?.user.identities?.some(identity => identity.provider === 'google') ?? false;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Minha conta"
          subtitle="Perfil, segurança e privacidade"
          onBack={() => router.back()}
          actionIcon="help-circle"
          actionLabel="Abrir suporte"
          onAction={() => router.push('/(panel)/suporte')}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>

        {/* Identidade da conta */}
        <Card style={styles.heroCard}>
          <View style={styles.heroIdentity}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={[styles.avatarText, { color: theme.onPrimary }]}>{initial}</Text>
            </View>
            <View style={styles.heroCopy}>
              {editingName ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={[styles.nameInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                    value={newName}
                    onChangeText={setNewName}
                    autoFocus
                    placeholder="Seu nome completo"
                    placeholderTextColor={theme.textSecondary}
                  />
                  <TouchableOpacity style={[styles.iconBtnSm, { backgroundColor: theme.primary }]} onPress={saveName} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={theme.onPrimary} /> : <Feather name="check" size={18} color={theme.onPrimary} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtnSm, { borderColor: theme.border, borderWidth: 1 }]}
                    onPress={() => { setEditingName(false); setNewName(authProfile?.name || ''); }}
                  >
                    <Feather name="x" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.nameRow} onPress={() => setEditingName(true)}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>{authProfile?.name || 'Nome não definido'}</Text>
                  <Feather name="edit-2" size={15} color={theme.textSecondary} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              )}
              <View style={styles.identityMeta}>
                <Badge variant={roleBadgeVariant} label={roleLabel} />
                {authProfile?.municipio ? (
                  <View style={styles.municipalityMeta}>
                    <Feather name="map-pin" size={12} color={theme.textSecondary} />
                    <Text style={[styles.municipalityText, { color: theme.textSecondary }]} numberOfLines={1}>
                      {authProfile.municipio}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          <View style={[styles.accountState, { backgroundColor: authProfile?.isApproved ? theme.successLight : theme.warningLight }]}>
            <Feather name={authProfile?.isApproved ? 'check-circle' : 'clock'} size={15} color={authProfile?.isApproved ? theme.success : theme.warning} />
            <Text style={[styles.accountStateText, { color: authProfile?.isApproved ? theme.success : theme.warning }]}>
              {authProfile?.isApproved ? 'Conta ativa e aprovada' : 'Conta aguardando aprovação'}
            </Text>
          </View>
        </Card>

        {/* Dados da conta */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Dados da Conta</Text>
        <Card style={styles.infoCard} noPadding>

          <InfoRow icon="mail" label="E-mail" value={authProfile?.email || '—'} theme={theme} />
          <Divider theme={theme} />

          {/* Telefone / WhatsApp */}
          {editingPhone ? (
            <View style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="smartphone" size={15} color={theme.textSecondary} style={{ marginRight: 4 }} />
                <TextInput
                  style={[styles.nameInput, { flex: 1, color: theme.text, borderColor: theme.primary, backgroundColor: theme.background }]}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  placeholder="(11) 98765-4321"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                  autoFocus
                  maxLength={16}
                />
                <TouchableOpacity style={[styles.iconBtnSm, { backgroundColor: theme.primary }]} onPress={savePhone} disabled={savingPhone}>
                  {savingPhone ? <ActivityIndicator size="small" color={theme.onPrimary} /> : <Feather name="check" size={18} color={theme.onPrimary} />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtnSm, { borderColor: theme.border, borderWidth: 1 }]}
                  onPress={() => { setEditingPhone(false); setPhoneInput(''); }}
                >
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 6, marginLeft: 27 }}>
                Número brasileiro com DDD · usado para login e notificações via WhatsApp
              </Text>
            </View>
          ) : hasPhone ? (
            <TouchableOpacity onPress={() => { setPhoneInput(phoneDisplay || ''); setEditingPhone(true); }}>
              <InfoRow
                icon="smartphone"
                label="WhatsApp"
                value={phoneDisplay!}
                actionIcon="edit-2"
                theme={theme}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.addPhoneRow, { borderColor: theme.primary }]}
              onPress={() => setEditingPhone(true)}
            >
              <View style={[styles.addPhoneIcon, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name="smartphone" size={16} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.addPhoneTitle, { color: theme.primary }]}>Adicionar número de WhatsApp</Text>
                <Text style={[styles.addPhoneDesc, { color: theme.textSecondary }]}>Para login e recebimento de notificações</Text>
              </View>
              <Feather name="plus" size={18} color={theme.primary} />
            </TouchableOpacity>
          )}

          <Divider theme={theme} />

          <InfoRow icon="map-pin" label="Município" value={authProfile?.municipio || '—'} theme={theme} />
          <Divider theme={theme} />

          <InfoRow
            icon="check-circle"
            label="Status da conta"
            value={authProfile?.isApproved ? 'Aprovada' : 'Aguardando aprovação'}
            valueColor={authProfile?.isApproved ? theme.success : theme.warning}
            theme={theme}
          />
          <Divider theme={theme} />

          <InfoRow icon="calendar" label="Membro desde" value={memberSinceText} theme={theme} />
          <Divider theme={theme} />

          <InfoRow icon="clock" label="Último acesso" value={lastAccessText} theme={theme} />
          <Divider theme={theme} />

          <InfoRow icon="wifi" label="IP da rede" value={deviceIp || '…'} theme={theme} />
          <Divider theme={theme} />

          <InfoRow
            icon={isOnlineReal ? 'globe' : 'wifi-off'}
            label="Conexão"
            value={isOnlineReal ? 'Online' : 'Sem internet'}
            valueColor={isOnlineReal ? theme.success : theme.error}
            theme={theme}
          />
        </Card>

        {/* Estatísticas */}
        {showStats && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              {isAgent ? 'Minhas Estatísticas' : 'Estatísticas do Município'}
            </Text>
            {statsError !== null ? (
              <ErrorState message={statsError} onRetry={loadStats} />
            ) : (
              <View style={styles.statsGrid}>
                <MetricCard value={statsLoading ? '—' : stats.total} label={isAgent ? 'Total' : 'Vistorias'} tone="primary" style={styles.metricCard} />
                <MetricCard value={statsLoading ? '—' : stats.altoRisco} label="Alto risco" tone="danger" style={styles.metricCard} />
                <MetricCard value={statsLoading ? '—' : stats.semana} label="Esta semana" tone="primary" style={styles.metricCard} />
                {isAgent && (
                  <MetricCard value={statsLoading ? '—' : stats.hoje} label="Hoje" tone="success" style={styles.metricCard} />
                )}
              </View>
            )}
          </>
        )}

        {/* Configurações */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Configurações</Text>

        <View style={[styles.themeCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={styles.themeHeader}>
            <View style={[styles.actionIcon, { backgroundColor: theme.secondary }]}>
              <Feather name="moon" size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Aparência</Text>
              <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Escolha o tema do aplicativo</Text>
            </View>
          </View>
          <View accessibilityRole="radiogroup" style={[styles.themeOptions, { backgroundColor: theme.background }]}>
            {THEME_OPTIONS.map(option => {
              const selected = themeMode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={`Tema ${option.label}`}
                  accessibilityState={{ selected }}
                  onPress={() => setThemeMode(option.value)}
                  style={[
                    styles.themeOption,
                    selected && { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Feather name={option.icon} size={16} color={selected ? theme.primary : theme.textSecondary} />
                  <Text style={[styles.themeOptionText, { color: selected ? theme.primary : theme.textSecondary }]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {resetSent ? (
          <StateBanner
            variant="success"
            title="E-mail enviado"
            description={`Verifique ${authProfile?.email} e abra o link de redefinição.`}
          />
        ) : (
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
            onPress={resetPassword}
            disabled={resetLoading}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: `${theme.primary}15` }]}>
              {resetLoading
                ? <ActivityIndicator size="small" color={theme.primary} />
                : <Feather name="lock" size={20} color={theme.primary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Redefinir Senha</Text>
              <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                {resetLoading ? 'Enviando link...' : 'Enviar link para o seu e-mail'}
              </Text>
            </View>
            {!resetLoading && <Feather name="chevron-right" size={20} color={theme.textSecondary} />}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
          onPress={linkGoogle}
          disabled={googleLinked || googleLinking || !isOnlineReal || localTestMode}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIcon, { backgroundColor: `${theme.primary}15` }]}>
            {googleLinking
              ? <ActivityIndicator size="small" color={theme.primary} />
              : <Feather name={googleLinked ? 'check-circle' : 'link'} size={20} color={googleLinked ? '#10B981' : theme.primary} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: googleLinked ? '#10B981' : theme.text }]}>Conta Google</Text>
            <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
              {googleLinked ? 'Vinculada a este acesso' : !isOnlineReal ? 'Conecte-se para vincular' : 'Vincular com sessão autenticada'}
            </Text>
          </View>
          {!googleLinked && !googleLinking && <Feather name="chevron-right" size={20} color={theme.textSecondary} />}
        </TouchableOpacity>

        {/* Privacidade e Permissões */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Privacidade e Permissões</Text>

        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
          onPress={() => setLgpdExpanded(v => !v)}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIcon, { backgroundColor: theme.successLight }]}>
            <Feather name="shield" size={20} color={theme.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: theme.text }]}>LGPD — Proteção de Dados</Text>
            <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Veja como seus dados são usados</Text>
          </View>
          <Feather name={lgpdExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        {lgpdExpanded && (
          <Card style={styles.lgpdCard}>
            <LgpdSection theme={theme} />
          </Card>
        )}

        <Card style={styles.permCard} noPadding>
          <PermRow icon="camera" label="Câmera" desc="Registro fotográfico das vistorias" theme={theme} />
          <Divider theme={theme} />
          <PermRow icon="map-pin" label="Localização" desc="Geolocalização das vistorias e do mapa" theme={theme} />
          <Divider theme={theme} />
          <PermRow icon="bell" label="Notificações" desc="Alertas de alto risco e novos formulários" theme={theme} />
          <Divider theme={theme} />
          <PermRow icon="smartphone" label="WhatsApp" desc="Envio de OTP para login seguro. O número não é compartilhado com terceiros." theme={theme} />
        </Card>

        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: theme.errorLight, borderColor: theme.error, marginTop: 8 }]}
          onPress={handleLogout}
        >
          <View style={[styles.actionIcon, { backgroundColor: theme.surface }]}>
            <Feather name="log-out" size={20} color={theme.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: theme.error }]}>Encerrar sessão</Text>
            <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Fazer logout do aplicativo</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// ── Sub-componentes ─────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, valueColor, actionIcon, theme }: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  valueColor?: string;
  actionIcon?: React.ComponentProps<typeof Feather>['name'];
  theme: any;
}) {
  return (
    <View style={infoStyles.row}>
      <Feather name={icon} size={15} color={theme.textSecondary} style={infoStyles.icon} />
      <Text style={[infoStyles.label, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: valueColor ?? theme.text }]} numberOfLines={1}>{value}</Text>
      {actionIcon && <Feather name={actionIcon} size={13} color={theme.textSecondary} style={{ marginLeft: 6 }} />}
    </View>
  );
}

function Divider({ theme }: { theme: any }) {
  return <View style={[infoStyles.divider, { backgroundColor: theme.border }]} />;
}

function PermRow({ icon, label, desc, theme }: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  desc: string;
  theme: any;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16 }}>
      <View style={[styles.actionIcon, { backgroundColor: `${theme.primary}12`, width: 36, height: 36, marginRight: 12 }]}>
        <Feather name={icon} size={16} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: 12, color: theme.textSecondary }}>{desc}</Text>
      </View>
    </View>
  );
}

function LgpdSection({ theme }: { theme: any }) {
  const items = [
    {
      title: 'Dados coletados',
      text: 'Nome, e-mail, número de telefone, município, fotos e geolocalização das vistorias realizadas.',
    },
    {
      title: 'Finalidade',
      text: 'Gestão de vistorias de risco, envio de notificações operacionais e autenticação via WhatsApp (OTP). Nenhum dado é vendido ou repassado a terceiros.',
    },
    {
      title: 'WhatsApp',
      text: 'O número de telefone é utilizado exclusivamente para envio de código de verificação (OTP) por um número oficial do TCS - Relatório de Risco. Não recebemos nem armazenamos conteúdo de conversas.',
    },
    {
      title: 'Seus direitos (Lei 13.709/2018 — LGPD)',
      text: 'Você pode solicitar a consulta, correção ou exclusão dos seus dados pessoais a qualquer momento entrando em contato com o administrador do seu município.',
    },
    {
      title: 'Retenção',
      text: 'Os dados são mantidos enquanto a conta estiver ativa. Após exclusão da conta, os dados pessoais identificáveis são removidos em até 30 dias.',
    },
  ];

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Feather name="shield" size={18} color={theme.success} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Política de Privacidade</Text>
      </View>
      {items.map((item, i) => (
        <View key={i}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
            {item.title}
          </Text>
          <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>{item.text}</Text>
        </View>
      ))}
      <View style={{ marginTop: 4, padding: 12, borderRadius: 10, backgroundColor: theme.successLight, borderWidth: 1, borderColor: theme.success }}>
        <Text style={{ fontSize: 12, color: theme.success, lineHeight: 18, fontWeight: '500' }}>
          Este aplicativo opera em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018). O tratamento dos dados tem base legal no exercício de função pública e no legítimo interesse da Defesa Civil.
        </Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16 },
  icon: { marginRight: 12 },
  label: { fontSize: 13, fontWeight: '500', width: 120 },
  value: { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  divider: { height: 1, marginHorizontal: 16 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  heroCard: { marginBottom: 24 },
  heroIdentity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroCopy: { flex: 1, minWidth: 0 },
  avatar: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  name: { flexShrink: 1, fontSize: 21, fontWeight: '700' },
  identityMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  municipalityMeta: { flex: 1, minWidth: 90, flexDirection: 'row', alignItems: 'center', gap: 4 },
  municipalityText: { flexShrink: 1, fontSize: 12, fontWeight: '500' },
  accountState: { marginTop: 16, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  accountStateText: { fontSize: 12, fontWeight: '700' },

  editRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8, width: '100%' },
  nameInput: {
    flex: 1, height: 44, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 16,
  },
  iconBtnSm: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  infoCard: { marginBottom: 24 },

  addPhoneRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16,
    borderTopWidth: 0, gap: 12,
  },
  addPhoneIcon: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  addPhoneTitle: { fontSize: 13, fontWeight: '600' },
  addPhoneDesc: { fontSize: 11, marginTop: 1 },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1.2, marginBottom: 12,
  },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 24, flexWrap: 'wrap' },
  metricCard: { flexGrow: 1, flexBasis: '46%' },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: 16, borderWidth: 1, marginBottom: 12,
  },
  themeCard: { borderRadius: 16, borderWidth: 1, marginBottom: 12, padding: 16, gap: 14 },
  themeHeader: { flexDirection: 'row', alignItems: 'center' },
  themeOptions: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  themeOption: {
    flex: 1, minHeight: 42, borderRadius: 9, borderWidth: 1, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  themeOptionText: { fontSize: 12, fontWeight: '700' },
  actionIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  actionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  actionDesc: { fontSize: 13 },

  lgpdCard: { marginBottom: 12, marginTop: -4 },
  permCard: { marginBottom: 12 },
});
