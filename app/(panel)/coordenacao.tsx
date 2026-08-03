import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { supabase } from '../../utils/supabase';
import { AppHeader, Button, EmptyState, FormField, LoadingState, SectionHeader, StateBanner } from '../../components/ui';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

interface OrganizationMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at?: string | null;
}

interface ActiveSession {
  id: string;
  user_id: string;
  device_name?: string | null;
  platform?: string | null;
  status: string;
  last_heartbeat_at: string;
}

export default function CoordenacaoScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { context } = useSubscription();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const allowed = ['owner', 'coordinator', 'supervisor'].includes(context?.membership?.role || '');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [{ data: memberData }, { data: sessionData }] = await Promise.all([
        supabase.from('organization_members').select('id,user_id,role,status,joined_at').order('created_at'),
        supabase.from('active_sessions').select('id,user_id,device_name,platform,status,last_heartbeat_at').eq('status', 'active').order('last_heartbeat_at', { ascending: false }),
      ]);
      setMembers((memberData || []) as OrganizationMember[]);
      setSessions((sessionData || []) as ActiveSession[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const createInvite = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc('create_organization_invite', {
      p_role: 'agent',
      p_email: email.trim() || null,
      p_expires_in_hours: 72,
    });
    setBusy(false);
    if (error || !data?.allowed) {
      Alert.alert('Convite não criado', error?.message || data?.reason || 'Verifique vagas e assinatura.');
      return;
    }
    await Clipboard.setStringAsync(data.token);
    setEmail('');
    Alert.alert('Convite criado', `Código ${data.token} copiado. Ele expira em 72 horas.`);
    load();
  };

  const endSession = (id: string) => Alert.alert(
    'Encerrar sessão?',
    'O aparelho perderá o acesso assim que validar a sessão novamente.',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Encerrar',
        style: 'destructive',
        onPress: async () => {
          await supabase.rpc('end_active_session', { p_session_id: id, p_reason: 'municipal_coordinator' });
          load();
        },
      },
    ],
  );

  if (!allowed) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <EmptyState
          icon="lock"
          title="Acesso restrito"
          description="Este módulo está disponível para responsáveis pela coordenação municipal."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  if (loading) {
    return <View style={[styles.container, { backgroundColor: theme.background }]}><LoadingState message="Carregando coordenação..." /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Coordenação municipal"
        subtitle={`${members.length} membros · ${sessions.length} sessões ativas`}
        onBack={() => router.back()}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.primary} />}
      >
        <StateBanner
          variant="info"
          title="Gestão de acesso"
          description="Convites respeitam as vagas do plano. Sessões encerradas perdem acesso na próxima validação."
        />

        <SectionHeader title="Convidar agente" subtitle="O código ficará válido por 72 horas" />
        <FormField
          label="E-mail do agente"
          placeholder="Opcional"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          helperText="Sem e-mail, o código poderá ser compartilhado manualmente"
        />
        <Button
          label="Criar e copiar convite"
          onPress={createInvite}
          loading={busy}
          iconLeft={<Feather name="user-plus" size={18} color={theme.onPrimary} />}
          fullWidth
        />

        <SectionHeader title={`Equipe (${members.length})`} subtitle="Pessoas vinculadas à operação municipal" />
        {members.length === 0 ? (
          <EmptyState icon="users" title="Equipe vazia" description="Crie um convite para adicionar o primeiro agente." />
        ) : members.map((member) => (
          <View key={member.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.icon, { backgroundColor: theme.secondary }]}>
              <Feather name="user" size={19} color={theme.primary} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{member.role}</Text>
              <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>{member.status} · {member.user_id.slice(0, 8)}</Text>
            </View>
          </View>
        ))}

        <SectionHeader title={`Sessões ativas (${sessions.length})`} subtitle="Aparelhos atualmente autorizados" />
        {sessions.length === 0 ? (
          <EmptyState icon="smartphone" title="Nenhuma sessão ativa" description="Os aparelhos autorizados aparecerão aqui." />
        ) : sessions.map((session) => (
          <View key={session.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.icon, { backgroundColor: theme.secondary }]}>
              <Feather name="smartphone" size={19} color={theme.primary} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{session.device_name || session.platform || 'Dispositivo'}</Text>
              <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>{new Date(session.last_heartbeat_at).toLocaleString('pt-BR')}</Text>
            </View>
            <Pressable
              onPress={() => endSession(session.id)}
              style={({ pressed }) => [styles.endButton, { backgroundColor: theme.errorLight }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Encerrar sessão"
            >
              <Feather name="log-out" color={theme.error} size={18} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing[4], paddingBottom: Spacing[8], gap: Spacing[4] },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[3], borderRadius: SpacingAlias.radiusMd, borderWidth: 1 },
  icon: { width: 44, height: 44, borderRadius: SpacingAlias.radiusMd, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  cardMeta: { marginTop: 3, fontSize: FontSize.xs },
  endButton: { width: 40, height: 40, borderRadius: SpacingAlias.radiusFull, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});
