import React from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { usagePercent } from '../../utils/subscription';
import { supabase } from '../../utils/supabase';

const RESOURCE_LABELS: Record<string, string> = {
  users: 'Agentes', inspections: 'Vistorias', invitations: 'Convites', storage_bytes: 'Armazenamento', sessions: 'Sessões',
};

const FEATURE_LABELS: Record<string, string> = {
  inspection_standard: 'Vistoria padrão',
  inspection_arv: 'Vistoria de Árvores (ARV)',
  training_mode: 'Modo treinamento',
  reports_basic: 'Relatórios básicos',
  reports_advanced: 'Relatórios avançados',
  reports_institutional: 'Relatórios institucionais',
  indicators_essential: 'Indicadores essenciais',
  indicators_complete: 'Indicadores completos',
  indicators_custom: 'Indicadores personalizados',
  municipal_coordination: 'Coordenação municipal',
};

const formatPrice = (cents?: number | null) => cents == null
  ? 'Personalizado'
  : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export default function AssinaturaScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { context, loading, error, refresh } = useSubscription();
  const canCoordinate = ['owner', 'coordinator', 'supervisor'].includes(context?.membership?.role || '');
  const [inviteToken, setInviteToken] = React.useState('');
  const acceptInvite = async () => {
    const token = inviteToken.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (token.length < 12) return Alert.alert('Convite inválido', 'Informe o código completo recebido da prefeitura.');
    const { data, error: inviteError } = await supabase.rpc('accept_organization_invite', { p_token: token });
    if (inviteError || !data?.accepted) return Alert.alert('Convite não aceito', inviteError?.message || ({ invalid: 'Código inválido.', expired: 'Este convite expirou.', already_used: 'Este convite já foi utilizado.', already_member: 'Sua conta já pertence a uma organização.', limit_reached: 'A prefeitura atingiu o limite de agentes.' } as Record<string,string>)[data?.reason] || 'Não foi possível aceitar o convite.');
    setInviteToken(''); await refresh(); Alert.alert('Convite aceito', 'Sua conta agora está vinculada à organização.');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.back, { backgroundColor: theme.iconBackground }]}><Feather name="arrow-left" size={20} color={theme.text} /></TouchableOpacity>
        <View><Text style={[styles.title, { color: theme.text }]}>Minha assinatura</Text><Text style={[styles.subtitle, { color: theme.textSecondary }]}>Plano, consumo e recursos</Text></View>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} /> : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={undefined}>
          {error && <Text style={[styles.notice, { color: theme.warningText, backgroundColor: theme.warningLight }]}>{error}</Text>}
          <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>PLANO ATUAL</Text>
            <Text style={[styles.plan, { color: theme.text }]}>{context?.plan?.name || 'Compatibilidade'}</Text>
            <Text style={{ color: theme.textSecondary }}>{context?.organization?.display_name || 'Conta individual'}</Text>
            {context?.plan?.commercial && <View style={[styles.commercial, { borderTopColor: theme.border }]}>
              <View><Text style={[styles.commercialLabel, { color: theme.textSecondary }]}>MENSALIDADE</Text><Text style={[styles.commercialValue, { color: theme.text }]}>{formatPrice(context.plan.commercial.monthly_price_cents)}</Text></View>
              <View><Text style={[styles.commercialLabel, { color: theme.textSecondary }]}>TESTE / CARÊNCIA</Text><Text style={[styles.commercialValue, { color: theme.text }]}>{context.plan.commercial.trial_days || 0}d / {context.plan.commercial.grace_days || 0}d</Text></View>
            </View>}
            <View style={[styles.status, { backgroundColor: theme.successLight }]}><Text style={{ color: theme.successText, fontWeight: '700' }}>{context?.subscription?.status || (context?.enforced ? 'Não configurada' : 'Migração sem bloqueios')}</Text></View>
          </View>

          <Text style={[styles.section, { color: theme.text }]}>Consumo</Text>
          {(context?.usage || []).length === 0 ? <Text style={{ color: theme.textSecondary }}>Nenhum limite comercial configurado.</Text> : context?.usage.map(item => {
            const percent = usagePercent(item) ?? 0;
            return <View key={item.resource} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.row}><Text style={{ color: theme.text, fontWeight: '700' }}>{RESOURCE_LABELS[item.resource]}</Text><Text style={{ color: theme.textSecondary }}>{item.consumed} / {item.limit ?? '∞'}</Text></View>
              {item.limit !== null && <View style={[styles.track, { backgroundColor: theme.surfaceVariant }]}><View style={[styles.fill, { width: `${percent}%`, backgroundColor: percent >= 100 ? theme.error : percent >= item.warning_percent ? theme.warning : theme.primary }]} /></View>}
            </View>;
          })}

          <Text style={[styles.section, { color: theme.text }]}>Recursos</Text>
          {Object.keys(context?.features || {}).length === 0 ? <Text style={{ color: theme.textSecondary }}>Recursos liberados pelo modo de compatibilidade.</Text> : Object.entries(context?.features || {}).map(([code, enabled]) => (
            <View key={code} style={styles.feature}><Feather name={enabled ? 'check-circle' : 'lock'} color={enabled ? theme.success : theme.muted} size={18} /><Text style={{ color: theme.text }}>{FEATURE_LABELS[code] || code.replaceAll('_', ' ')}</Text></View>
          ))}

          {!context?.organization && <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 20 }]}><Text style={{ color: theme.text, fontWeight: '800', marginBottom: 8 }}>Entrar em uma prefeitura</Text><Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 10 }}>O código define a organização e só pode ser usado uma vez.</Text><TextInput value={inviteToken} onChangeText={setInviteToken} autoCapitalize="characters" placeholder="CÓDIGO DO CONVITE" placeholderTextColor={theme.muted} style={[styles.inviteInput, { color: theme.text, borderColor: theme.border }]} /><TouchableOpacity onPress={acceptInvite} style={[styles.inviteButton, { backgroundColor: theme.primary }]}><Text style={styles.actionText}>Aceitar convite</Text></TouchableOpacity></View>}

          {canCoordinate && <TouchableOpacity style={[styles.action, { backgroundColor: theme.primary }]} onPress={() => router.push('/(panel)/coordenacao')}><Feather name="users" color="#fff" size={18} /><Text style={styles.actionText}>Coordenação municipal</Text></TouchableOpacity>}
          <TouchableOpacity style={[styles.action, { backgroundColor: theme.primary }]} onPress={() => router.push('/(panel)/planos')}><Feather name="credit-card" color="#fff" size={18} /><Text style={styles.actionText}>Conhecer planos e solicitar contratação</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.action, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]} onPress={() => router.push('/(panel)/suporte')}><Feather name="help-circle" color={theme.primary} size={18} /><Text style={[styles.actionText, { color: theme.text }]}>Abrir chamado</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => refresh()}><Text style={[styles.refresh, { color: theme.primary }]}>Atualizar informações</Text></TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  back: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 21, fontWeight: '800' }, subtitle: { fontSize: 12, marginTop: 2 },
  content: { padding: 20, paddingBottom: 60 }, notice: { padding: 12, borderRadius: 10, marginBottom: 12 }, hero: { padding: 20, borderRadius: 18, borderWidth: 1 }, eyebrow: { fontSize: 10, letterSpacing: 1.4, fontWeight: '800' }, plan: { fontSize: 26, fontWeight: '800', marginVertical: 5 },
  status: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, marginTop: 14 }, section: { fontSize: 17, fontWeight: '800', marginTop: 24, marginBottom: 10 }, card: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 }, row: { flexDirection: 'row', justifyContent: 'space-between' },
  commercial: { flexDirection: 'row', gap: 28, borderTopWidth: 1, marginTop: 16, paddingTop: 14 }, commercialLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7 }, commercialValue: { fontSize: 14, fontWeight: '800', marginTop: 3 },
  track: { height: 7, borderRadius: 99, marginTop: 12, overflow: 'hidden' }, fill: { height: 7, borderRadius: 99 }, feature: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 7 }, action: { height: 52, borderRadius: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, actionText: { color: '#fff', fontWeight: '800' }, refresh: { textAlign: 'center', padding: 18, fontWeight: '700' },
  inviteInput: { height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, letterSpacing: 1.5 }, inviteButton: { height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
});
