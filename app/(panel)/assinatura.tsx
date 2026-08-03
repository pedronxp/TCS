import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { usagePercent } from '../../utils/subscription';
import { supabase } from '../../utils/supabase';
import { useBottomTabPadding } from '../../utils/useBottomTabPadding';
import { PortalStateCard, PortalStatusBadge } from '../../components/portal';
import { AppHeader, Button, FormField, SectionHeader, StateBanner } from '../../components/ui';

const RESOURCE_LABELS: Record<string, string> = {
  users: 'Agentes',
  inspections: 'Vistorias',
  invitations: 'Convites',
  storage_bytes: 'Armazenamento',
  sessions: 'Sessões',
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
  const bottomPad = useBottomTabPadding();
  const { context, loading, error, refresh } = useSubscription();
  const [inviteToken, setInviteToken] = React.useState('');
  const canCoordinate = ['owner', 'coordinator', 'supervisor'].includes(context?.membership?.role || '');
  const usage = context?.usage || [];
  const features = Object.entries(context?.features || {});

  const acceptInvite = async () => {
    const token = inviteToken.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (token.length < 12) {
      Alert.alert('Convite inválido', 'Informe o código completo recebido da prefeitura.');
      return;
    }
    const { data, error: inviteError } = await supabase.rpc('accept_organization_invite', { p_token: token });
    if (inviteError || !data?.accepted) {
      const reasons: Record<string, string> = {
        invalid: 'Código inválido.',
        expired: 'Este convite expirou.',
        already_used: 'Este convite já foi utilizado.',
        already_member: 'Sua conta já pertence a uma organização.',
        limit_reached: 'A prefeitura atingiu o limite de agentes.',
      };
      Alert.alert('Convite não aceito', inviteError?.message || reasons[data?.reason] || 'Não foi possível aceitar o convite.');
      return;
    }
    setInviteToken('');
    await refresh();
    Alert.alert('Convite aceito', 'Sua conta agora está vinculada à organização.');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Minha assinatura"
          subtitle="Plano, consumo e recursos"
          onBack={() => router.back()}
          actionIcon="refresh-cw"
          actionLabel="Atualizar assinatura"
          onAction={() => void refresh()}
        />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <PortalStateCard kind="loading" title="Carregando assinatura" description="Consultando plano, consumo e permissões." />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <PortalStateCard
              kind="error"
              title="Não foi possível atualizar a assinatura"
              description={error}
              actionLabel="Tentar novamente"
              onAction={() => void refresh()}
              compact
            />
          ) : null}

          <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.heroTop}>
              <View style={[styles.planIcon, { backgroundColor: theme.secondary }]}>
                <Feather name="package" size={24} color={theme.primary} />
              </View>
              <PortalStatusBadge
                status={context?.subscription?.status}
                label={!context?.subscription ? (context?.enforced ? 'Não configurada' : 'Migração sem bloqueios') : undefined}
              />
            </View>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>PLANO ATUAL</Text>
            <Text style={[styles.plan, { color: theme.text }]}>{context?.plan?.name || 'Compatibilidade'}</Text>
            <Text style={[styles.organization, { color: theme.textSecondary }]}>
              {context?.organization?.display_name || 'Conta individual'}
            </Text>
            {context?.plan?.commercial ? (
              <View style={[styles.commercialGrid, { borderTopColor: theme.border }]}>
                <CommercialMetric label="Mensalidade" value={formatPrice(context.plan.commercial.monthly_price_cents)} theme={theme} />
                <CommercialMetric label="Teste" value={`${context.plan.commercial.trial_days || 0} dias`} theme={theme} />
                <CommercialMetric label="Carência" value={`${context.plan.commercial.grace_days || 0} dias`} theme={theme} />
              </View>
            ) : null}
          </View>

          <SectionHeader title="Consumo" subtitle="Uso atual dos limites contratados" />
          {usage.length === 0 ? (
            <PortalStateCard kind="empty" title="Nenhum limite comercial configurado" description="O consumo aparecerá quando os limites do plano forem publicados." compact />
          ) : (
            <View style={styles.usageGrid}>
              {usage.map(item => {
                const percent = usagePercent(item) ?? 0;
                const tone = percent >= 100 ? theme.error : percent >= item.warning_percent ? theme.warning : theme.primary;
                return (
                  <View key={item.resource} style={[styles.usageCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.usageHeader}>
                      <Text style={[styles.usageLabel, { color: theme.text }]}>{RESOURCE_LABELS[item.resource] || item.resource}</Text>
                      <Text style={[styles.usageValue, { color: theme.text }]}>{item.consumed} / {item.limit ?? '∞'}</Text>
                    </View>
                    <Text style={[styles.usageDetail, { color: theme.textSecondary }]}>{Math.round(percent)}% utilizado</Text>
                    {item.limit !== null ? (
                      <View style={[styles.track, { backgroundColor: theme.surfaceVariant }]}>
                        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: tone }]} />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

          <SectionHeader title="Recursos do plano" subtitle="Funcionalidades liberadas para esta conta" />
          {features.length === 0 ? (
            <StateBanner title="Modo de compatibilidade" description="Os recursos disponíveis permanecem liberados durante a migração." />
          ) : (
            <View style={[styles.featureCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {features.map(([code, enabled], index) => (
                <View key={code}>
                  <View style={styles.feature}>
                    <View style={[styles.featureIcon, { backgroundColor: enabled ? theme.successLight : theme.background }]}>
                      <Feather name={enabled ? 'check' : 'lock'} color={enabled ? theme.success : theme.muted} size={17} />
                    </View>
                    <Text style={[styles.featureText, { color: enabled ? theme.text : theme.textSecondary }]}>{FEATURE_LABELS[code] || code.replaceAll('_', ' ')}</Text>
                  </View>
                  {index < features.length - 1 ? <View style={[styles.divider, { backgroundColor: theme.divider }]} /> : null}
                </View>
              ))}
            </View>
          )}

          {!context?.organization ? (
            <View style={[styles.inviteCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.inviteIcon, { backgroundColor: theme.secondary }]}>
                <Feather name="link" size={20} color={theme.primary} />
              </View>
              <SectionHeader title="Entrar em uma prefeitura" subtitle="O convite vincula sua conta a uma organização e só pode ser usado uma vez." />
              <FormField
                label="Código do convite"
                value={inviteToken}
                onChangeText={setInviteToken}
                autoCapitalize="characters"
                placeholder="CÓDIGO DO CONVITE"
                helperText="Use o código completo enviado pelo administrador."
              />
              <Button label="Aceitar convite" onPress={() => void acceptInvite()} fullWidth style={styles.buttonSpacing} />
            </View>
          ) : null}

          <View style={styles.actions}>
            {canCoordinate ? (
              <Button
                label="Coordenação municipal"
                onPress={() => router.push('/(panel)/coordenacao')}
                variant="secondary"
                fullWidth
                iconLeft={<Feather name="users" size={18} color={theme.primary} />}
              />
            ) : null}
            <Button
              label="Conhecer planos"
              onPress={() => router.push('/(panel)/planos')}
              fullWidth
              iconLeft={<Feather name="credit-card" size={18} color="#FFFFFF" />}
            />
            <Button
              label="Abrir chamado"
              onPress={() => router.push('/(panel)/suporte')}
              variant="secondary"
              fullWidth
              iconLeft={<Feather name="help-circle" size={18} color={theme.primary} />}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function CommercialMetric({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <View style={styles.commercialMetric}>
      <Text style={[styles.commercialLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.commercialValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 20 },
  loading: { padding: 20 },
  hero: { padding: 20, borderRadius: 20, borderWidth: 1 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  planIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, letterSpacing: 1.4, fontWeight: '800' },
  plan: { fontSize: 28, fontWeight: '800', marginTop: 5 },
  organization: { marginTop: 4, fontSize: 13 },
  commercialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, borderTopWidth: 1, marginTop: 18, paddingTop: 16 },
  commercialMetric: { flexGrow: 1, minWidth: 82 },
  commercialLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  commercialValue: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  usageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  usageCard: { flexGrow: 1, flexBasis: '46%', minWidth: 144, padding: 14, borderRadius: 16, borderWidth: 1 },
  usageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  usageLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  usageValue: { fontSize: 13, fontWeight: '800' },
  usageDetail: { fontSize: 11, marginTop: 6 },
  track: { height: 7, borderRadius: 99, marginTop: 12, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 99 },
  featureCard: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16 },
  feature: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12 },
  featureIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, fontSize: 13, fontWeight: '600' },
  divider: { height: 1 },
  inviteCard: { borderWidth: 1, borderRadius: 18, padding: 18 },
  inviteIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  buttonSpacing: { marginTop: 16 },
  actions: { gap: 10 },
});
