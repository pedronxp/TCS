import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Alert, Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Network from 'expo-network';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { supabase } from '../../utils/supabase';
import { logger } from '../../utils/logger';
import { Badge, Card, ErrorState } from '../../components/ui';
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Meu Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>

        {/* Card principal — avatar + nome */}
        <Card style={styles.heroCard}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

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
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="check" size={18} color="#FFF" />}
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
              <Text style={[styles.name, { color: theme.text }]}>{authProfile?.name || 'Nome não definido'}</Text>
              <Feather name="edit-2" size={15} color={theme.textSecondary} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Badge variant={roleBadgeVariant} label={roleLabel} />
            {authProfile?.municipio ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="map-pin" size={11} color={theme.textSecondary} />
                <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '500' }}>
                  {authProfile.municipio}
                </Text>
              </View>
            ) : null}
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
                  {savingPhone ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="check" size={18} color="#FFF" />}
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
            valueColor={authProfile?.isApproved ? '#10B981' : '#F59E0B'}
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
            valueColor={isOnlineReal ? '#10B981' : '#EF4444'}
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
                <StatCard
                  icon="clipboard"
                  label={isAgent ? 'Total' : 'Vistorias'}
                  value={stats.total}
                  color={theme.primary}
                  loading={statsLoading}
                  theme={theme}
                />
                <StatCard
                  icon="alert-triangle"
                  label="Alto Risco"
                  value={stats.altoRisco}
                  color="#EF4444"
                  loading={statsLoading}
                  theme={theme}
                />
                <StatCard
                  icon="trending-up"
                  label="Esta semana"
                  value={stats.semana}
                  color="#8B5CF6"
                  loading={statsLoading}
                  theme={theme}
                />
                {isAgent && (
                  <StatCard
                    icon="sun"
                    label="Hoje"
                    value={stats.hoje}
                    color="#10B981"
                    loading={statsLoading}
                    theme={theme}
                  />
                )}
              </View>
            )}
          </>
        )}

        {/* Configurações */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Configurações</Text>

        <View style={[styles.actionRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder, flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.actionIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name={themeMode === 'light' ? 'sun' : themeMode === 'dark' ? 'moon' : 'smartphone'} size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Aparência</Text>
              <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Escolha o tema do aplicativo</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['system', 'light', 'dark'] as const).map((mode) => {
              const isSelected = themeMode === mode;
              const labels = { system: 'Sistema', light: 'Claro', dark: 'Escuro' };
              const icons = { system: 'smartphone', light: 'sun', dark: 'moon' } as const;
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setThemeMode(mode)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: isSelected ? theme.primary : theme.background,
                    borderWidth: 1,
                    borderColor: isSelected ? theme.primary : theme.border,
                    gap: 6,
                  }}
                >
                  <Feather name={icons[mode]} size={16} color={isSelected ? '#FFF' : theme.textSecondary} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? '#FFF' : theme.textSecondary }}>
                    {labels[mode]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {resetSent ? (
          <View style={[styles.actionRow, { backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)' }]}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
              <Feather name="check-circle" size={20} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: '#10B981' }]}>E-mail enviado!</Text>
              <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                Verifique {authProfile?.email} e clique no link.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setResetSent(false)}
              style={{ padding: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
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
          style={[styles.actionRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
          onPress={() => setLgpdExpanded(v => !v)}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
            <Feather name="shield" size={20} color="#10B981" />
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
          style={[styles.actionRow, { backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.15)', marginTop: 8 }]}
          onPress={handleLogout}
        >
          <View style={[styles.actionIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
            <Feather name="log-out" size={20} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: '#EF4444' }]}>Encerrar Sessão</Text>
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
        <Feather name="shield" size={18} color="#10B981" />
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
      <View style={{ marginTop: 4, padding: 12, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
        <Text style={{ fontSize: 12, color: '#10B981', lineHeight: 18, fontWeight: '500' }}>
          Este aplicativo opera em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018). O tratamento dos dados tem base legal no exercício de função pública e no legítimo interesse da Defesa Civil.
        </Text>
      </View>
    </View>
  );
}

function StatCard({ icon, label, value, color, loading, theme }: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: number;
  color: string;
  loading: boolean;
  theme: any;
}) {
  return (
    <Card style={statStyles.card}>
      <View style={[statStyles.iconWrap, { backgroundColor: `${color}15` }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      {loading
        ? <ActivityIndicator size="small" color={color} style={{ marginVertical: 4 }} />
        : <Text style={[statStyles.value, { color }]}>{value}</Text>}
      <Text style={[statStyles.label, { color: theme.textSecondary }]}>{label}</Text>
    </Card>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16 },
  icon: { marginRight: 12 },
  label: { fontSize: 13, fontWeight: '500', width: 120 },
  value: { flex: 1, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  divider: { height: 1, marginHorizontal: 16 },
});

const statStyles = StyleSheet.create({
  card: { flex: 1, minWidth: 90, alignItems: 'center', gap: 6 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  value: { fontSize: 26, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollContent: { padding: 20, paddingBottom: 100 },

  heroCard: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 22, fontWeight: '700' },

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

  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24, flexWrap: 'wrap' },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: 16, borderWidth: 1, marginBottom: 12,
  },
  actionIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  actionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  actionDesc: { fontSize: 13 },

  lgpdCard: { marginBottom: 12, marginTop: -4 },
  permCard: { marginBottom: 12 },
});
