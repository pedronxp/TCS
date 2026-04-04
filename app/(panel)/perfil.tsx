import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabase';
import { logger } from '../../utils/logger';
import { Badge, Card, ErrorState } from '../../components/ui';
import { formatarData, formatarDataHora } from '../../utils/htmlUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ROLE_LABELS: Record<string, string> = {
  agent:        'Agente de Campo',
  supervisor:   'Supervisor',
  admin:        'Administrador',
  master_admin: 'Master Admin',
};

export default function PerfilScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, profile: authProfile, loading: authLoading, signOut, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(authProfile?.name || '');
  const [stats, setStats] = useState({ total: 0, altoRisco: 0, hoje: 0, semana: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [deviceIp, setDeviceIp] = useState<string>('');

  useEffect(() => {
    if (authProfile) {
      setNewName(authProfile.name || '');
      loadStats();
    }
    // Capturar IP real do dispositivo — múltiplas fontes de fallback
    const fetchIp = async () => {
      const sources = [
        'https://api.ipify.org?format=json',
        'https://api.seeip.org/jsonip',
        'https://api.myip.com',
      ];
      for (const url of sources) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);
          const data = await res.json();
          const ip = data.ip || data.IP || '';
          if (ip && ip !== '0.0.0.0' && ip !== '127.0.0.1') {
            setDeviceIp(ip);
            return;
          }
        } catch { /* tenta próxima fonte */ }
      }
      setDeviceIp('Indisponível');
    };
    fetchIp();
  }, [authProfile]);

  const loadStats = async () => {
    setStatsError(null);
    setStatsLoading(true);
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const semanaAtras = new Date(Date.now() - 7 * 24 * 3600000).toISOString();

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

  const resetPassword = async () => {
    if (!authProfile?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authProfile.email, {
        redirectTo: 'defesacivil://reset-password',
      });
      if (error) throw error;
      Alert.alert('E-mail enviado', 'Verifique sua caixa de entrada para redefinir a senha.');
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar o e-mail de redefinição.');
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
  const roleLabel = ROLE_LABELS[authProfile?.role ?? ''] || authProfile?.role || '—';
  const isAgent = authProfile?.role === 'agent';
  const showStats = isAgent || authProfile?.role === 'supervisor' || authProfile?.role === 'admin';

  const roleBadgeVariant =
    authProfile?.role === 'agent' ? 'success' :
    authProfile?.role === 'admin' ? 'error' :
    'warning';

  // ── Último acesso ──
  const lastSignIn = session?.user?.last_sign_in_at;
  const lastAccessText = lastSignIn
    ? formatarDataHora(lastSignIn)
    : '—';

  // ── Membro desde ──
  const memberSinceText = authProfile?.createdAt
    ? formatarData(authProfile.createdAt)
    : '—';

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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Card principal — avatar + nome */}
        <Card style={styles.heroCard}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

          {/* ── Nome ── */}
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

          {/* Badge de cargo */}
          <Badge variant={roleBadgeVariant} label={roleLabel} />
        </Card>

        {/* Dados da conta */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Dados da Conta</Text>
        <Card style={styles.infoCard} noPadding>

          <InfoRow icon="mail" label="E-mail" value={authProfile?.email || '—'} theme={theme} />
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

          <InfoRow icon="wifi" label="IP atual" value={deviceIp || '…'} theme={theme} />
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

        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
          onPress={resetPassword}
        >
          <View style={[styles.actionIcon, { backgroundColor: `${theme.primary}15` }]}>
            <Feather name="lock" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: theme.text }]}>Redefinir Senha</Text>
            <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>Enviar link para o seu e-mail</Text>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.15)' }]}
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

// ── Sub-componentes ────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, valueColor, theme }: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  valueColor?: string;
  theme: any;
}) {
  return (
    <View style={infoStyles.row}>
      <Feather name={icon} size={15} color={theme.textSecondary} style={infoStyles.icon} />
      <Text style={[infoStyles.label, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: valueColor ?? theme.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Divider({ theme }: { theme: any }) {
  return <View style={[infoStyles.divider, { backgroundColor: theme.border }]} />;
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
  card: {
    flex: 1, minWidth: 90, alignItems: 'center', gap: 6,
  },
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

  // Hero card
  heroCard: {
    alignItems: 'center', marginBottom: 24,
  },
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

  // Info card
  infoCard: { marginBottom: 24 },

  // Section title
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1.2, marginBottom: 12,
  },

  // Stats grid
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24, flexWrap: 'wrap' },

  // Actions
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
});
