import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductIdentity } from '../brand';
import { AppHeader, Button, FormField, StateBanner } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  BillingCycle,
  COMMERCIAL_PLANS,
  CommercialPlan,
  formatPlanPrice,
  PlanAudience,
} from '../../constants/CommercialPlans';
import { supabase } from '../../utils/supabase';

type Mode = 'public' | 'panel';

interface PlanCatalogScreenProps {
  mode: Mode;
}

interface LatestRequest {
  id: string;
  status: string;
  billing_cycle: BillingCycle;
  created_at: string;
  plans: { name: string } | { name: string }[] | null;
}

const REQUEST_STATUS: Record<string, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  pending: { label: 'Em análise', icon: 'clock' },
  contacted: { label: 'Contato iniciado', icon: 'phone-call' },
  awaiting_account: { label: 'Aguardando cadastro', icon: 'user-plus' },
  approved: { label: 'Plano ativado', icon: 'check-circle' },
  rejected: { label: 'Solicitação encerrada', icon: 'x-circle' },
  canceled: { label: 'Solicitação cancelada', icon: 'slash' },
};

const normalizePhone = (value: string) => value.replace(/[^0-9+()\-\s]/g, '').slice(0, 30);

export function PlanCatalogScreen({ mode }: PlanCatalogScreenProps) {
  const { theme, isDark } = useTheme();
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [audience, setAudience] = useState<PlanAudience>('organization');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<CommercialPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [latestRequest, setLatestRequest] = useState<LatestRequest | null>(null);
  const [contactName, setContactName] = useState(profile?.name || '');
  const [contactEmail, setContactEmail] = useState(profile?.email || session?.user.email || '');
  const [contactPhone, setContactPhone] = useState(profile?.phone || '');
  const [organizationName, setOrganizationName] = useState('');
  const [municipalityName, setMunicipalityName] = useState(profile?.municipio || '');
  const [message, setMessage] = useState('');

  const visiblePlans = useMemo(
    () => COMMERCIAL_PLANS.filter(plan => plan.audience === audience),
    [audience],
  );

  useEffect(() => {
    if (!session) return;
    supabase
      .from('plan_purchase_requests')
      .select('id, status, billing_cycle, created_at, plans(name)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLatestRequest((data as LatestRequest | null) || null));
  }, [session, successId]);

  const chooseAudience = (value: PlanAudience) => {
    setAudience(value);
    setBillingCycle('monthly');
    setSuccessId(null);
  };

  const openRequest = (plan: CommercialPlan) => {
    setSelectedPlan(plan);
    setSuccessId(null);
    if (plan.customContract) setBillingCycle('custom');
    else if (billingCycle === 'custom') setBillingCycle('monthly');
  };

  const closeRequest = () => {
    if (submitting) return;
    setSelectedPlan(null);
  };

  const submitRequest = async () => {
    if (!selectedPlan) return;
    const email = contactEmail.trim().toLowerCase();
    if (contactName.trim().length < 2) {
      Alert.alert('Nome necessário', 'Informe o nome da pessoa responsável pela contratação.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('E-mail inválido', 'Informe um e-mail válido para receber o retorno comercial.');
      return;
    }
    if (contactPhone.trim().length > 0 && contactPhone.trim().length < 8) {
      Alert.alert('Telefone inválido', 'Informe um telefone com DDD ou deixe o campo vazio.');
      return;
    }
    if (selectedPlan.audience === 'organization' && !organizationName.trim() && !municipalityName.trim()) {
      Alert.alert('Órgão necessário', 'Informe o nome da prefeitura, Defesa Civil ou município.');
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc('submit_plan_purchase_request', {
      p_plan_code: selectedPlan.code,
      p_billing_cycle: selectedPlan.customContract ? 'custom' : billingCycle,
      p_contact_name: contactName.trim(),
      p_contact_email: email,
      p_contact_phone: contactPhone.trim() || null,
      p_organization_name: organizationName.trim() || null,
      p_municipality_name: municipalityName.trim() || null,
      p_customer_message: message.trim() || null,
    });
    setSubmitting(false);

    if (error || !data?.accepted) {
      Alert.alert(
        'Solicitação não enviada',
        error?.message?.includes('organization_name_required')
          ? 'Informe o órgão ou município responsável.'
          : 'Não foi possível registrar a solicitação agora. Verifique sua conexão e tente novamente.',
      );
      return;
    }

    setSuccessId(data.request_id || 'existing-request');
    setSelectedPlan(null);
  };

  const latestPlanName = latestRequest
    ? Array.isArray(latestRequest.plans) ? latestRequest.plans[0]?.name : latestRequest.plans?.name
    : null;
  const latestStatus = latestRequest ? REQUEST_STATUS[latestRequest.status] || REQUEST_STATUS.pending : null;
  const requestVariant = latestRequest?.status === 'approved'
    ? 'success' as const
    : ['rejected', 'canceled'].includes(latestRequest?.status || '')
      ? 'danger' as const
      : 'warning' as const;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Planos TCS"
          subtitle="Estrutura adequada para cada operação"
          onBack={() => router.back()}
          actionIcon={mode === 'panel' ? 'help-circle' : undefined}
          actionLabel="Falar com suporte"
          onAction={mode === 'panel' ? () => router.push('/(panel)/suporte') : undefined}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 40 }]} showsVerticalScrollIndicator={false}>
        {mode === 'public' && <View style={styles.identity}><ProductIdentity variant="compact" /></View>}

        <StateBanner
          title="Contratação assistida"
          description="A equipe TCS analisa a solicitação antes de configurar pagamento e ativação."
        />

        {(successId || latestRequest) && (
          <StateBanner
            variant={successId ? 'success' : requestVariant}
            title={successId ? 'Solicitação recebida' : latestStatus?.label || 'Em análise'}
            description={successId
              ? 'Nossa equipe fará a análise e entrará em contato pelos dados informados.'
              : `${latestPlanName || 'Plano solicitado'} · acompanhe o retorno pelo seu contato cadastrado.`}
          />
        )}

        <View style={[styles.segment, { backgroundColor: theme.surfaceVariant }]}>
          <TouchableOpacity
            style={[styles.segmentButton, audience === 'individual' && { backgroundColor: theme.surface }]}
            onPress={() => chooseAudience('individual')}
          >
            <Feather name="user" size={16} color={audience === 'individual' ? theme.primary : theme.textSecondary} />
            <Text style={[styles.segmentLabel, { color: audience === 'individual' ? theme.text : theme.textSecondary }]}>Individual</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, audience === 'organization' && { backgroundColor: theme.surface }]}
            onPress={() => chooseAudience('organization')}
          >
            <Feather name="shield" size={16} color={audience === 'organization' ? theme.primary : theme.textSecondary} />
            <Text style={[styles.segmentLabel, { color: audience === 'organization' ? theme.text : theme.textSecondary }]}>Defesa Civil</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.billingRow}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>Forma de contratação</Text>
          <View style={[styles.billingToggle, { borderColor: theme.border }]}>
            {(['monthly', 'annual'] as BillingCycle[]).map(cycle => (
              <TouchableOpacity
                key={cycle}
                style={[styles.billingOption, billingCycle === cycle && { backgroundColor: theme.primary }]}
                onPress={() => setBillingCycle(cycle)}
              >
                <Text style={[styles.billingText, { color: billingCycle === cycle ? theme.onPrimary : theme.textSecondary }]}>
                  {cycle === 'monthly' ? 'Mensal' : 'Anual'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.planList}>
          {visiblePlans.map(plan => {
            const shownCycle: BillingCycle = plan.customContract ? 'custom' : billingCycle;
            const price = shownCycle === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents;
            return (
              <View key={plan.code} style={[styles.planCard, { backgroundColor: theme.surface, borderColor: plan.featured ? theme.primary : theme.border }]}>
                {plan.featured && (
                  <View style={[styles.featuredBadge, { backgroundColor: theme.primary }]}>
                    <Text style={[styles.featuredText, { color: theme.onPrimary }]}>MAIS ESCOLHIDO</Text>
                  </View>
                )}
                <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
                <Text style={[styles.planDescription, { color: theme.textSecondary }]}>{plan.description}</Text>
                <View style={styles.priceRow}>
                  {plan.customContract && <Text style={[styles.fromText, { color: theme.textSecondary }]}>a partir de</Text>}
                  <Text style={[styles.price, { color: theme.text }]}>{formatPlanPrice(price)}</Text>
                  <Text style={[styles.period, { color: theme.textSecondary }]}>{shownCycle === 'annual' ? '/ano' : '/mês'}</Text>
                </View>
                {shownCycle === 'annual' && !plan.customContract && (
                  <Text style={[styles.saving, { color: theme.successText }]}>2 mensalidades de economia no plano anual</Text>
                )}
                <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                {plan.features.map(feature => (
                  <View key={feature} style={styles.featureRow}>
                    <Feather name="check" size={16} color={theme.success} />
                    <Text style={[styles.featureText, { color: theme.text }]}>{feature}</Text>
                  </View>
                ))}
                <Button
                  label={plan.audience === 'organization' ? 'Solicitar proposta' : 'Solicitar contratação'}
                  variant={plan.featured ? 'primary' : 'secondary'}
                  onPress={() => openRequest(plan)}
                  fullWidth
                  style={styles.cta}
                  iconRight={<Feather name="arrow-right" size={17} color={plan.featured ? theme.onPrimary : theme.primary} />}
                />
              </View>
            );
          })}
        </View>

        {mode === 'public' && (
          <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/(auth)/login')}>
            <Text style={[styles.loginText, { color: theme.textSecondary }]}>Já possui acesso? </Text>
            <Text style={[styles.loginText, { color: theme.primary, fontWeight: '800' }]}>Entrar no sistema</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={!!selectedPlan} animationType="slide" transparent onRequestClose={closeRequest}>
        <KeyboardAvoidingView style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Solicitar {selectedPlan?.name}</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Sem cobrança nesta etapa</Text>
              </View>
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.iconBackground }]} onPress={closeRequest}>
                <Feather name="x" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
              <FormField label="Responsável" required value={contactName} onChangeText={setContactName} placeholder="Nome completo" />
              <FormField label="E-mail" required value={contactEmail} onChangeText={setContactEmail} placeholder="nome@exemplo.com" keyboardType="email-address" autoCapitalize="none" />
              <FormField label="Telefone / WhatsApp" value={contactPhone} onChangeText={value => setContactPhone(normalizePhone(value))} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
              {selectedPlan?.audience === 'organization' && (
                <>
                  <FormField label="Prefeitura ou órgão" required value={organizationName} onChangeText={setOrganizationName} placeholder="Defesa Civil Municipal" />
                  <FormField label="Município" value={municipalityName} onChangeText={setMunicipalityName} placeholder="Município / UF" />
                </>
              )}
              <FormField label="Observações" value={message} onChangeText={value => setMessage(value.slice(0, 1000))} placeholder="Conte brevemente sobre sua operação" multiline inputStyle={styles.textArea} />
              <Button
                label="Enviar solicitação"
                onPress={() => void submitRequest()}
                loading={submitting}
                fullWidth
                size="lg"
                iconLeft={<Feather name="send" size={18} color={theme.onPrimary} />}
              />
              <Text style={[styles.privacyText, { color: theme.textSecondary }]}>Ao enviar, você autoriza o contato da equipe TCS exclusivamente sobre esta contratação.</Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18 },
  identity: { alignItems: 'center', paddingVertical: 18 },
  segment: { flexDirection: 'row', padding: 4, borderRadius: 14, marginTop: 16, marginBottom: 18 },
  segmentButton: { flex: 1, minHeight: 46, borderRadius: 11, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  segmentLabel: { fontSize: 13, fontWeight: '800' },
  billingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  sectionLabel: { fontSize: 15, fontWeight: '900', flex: 1 },
  billingToggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  billingOption: { paddingHorizontal: 13, paddingVertical: 9 },
  billingText: { fontSize: 11, fontWeight: '800' },
  planList: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  planCard: { flexGrow: 1, flexBasis: '46%', minWidth: 280, borderRadius: 20, borderWidth: 1, padding: 20, overflow: 'hidden' },
  featuredBadge: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  featuredText: { fontSize: 9, letterSpacing: 1, fontWeight: '900' },
  planName: { fontSize: 22, fontWeight: '900' },
  planDescription: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 4, marginTop: 18 },
  fromText: { fontSize: 11, width: '100%' },
  price: { fontSize: 29, fontWeight: '900', letterSpacing: -0.8 },
  period: { fontSize: 12, fontWeight: '700' },
  saving: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  divider: { height: 1, marginVertical: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 },
  featureText: { fontSize: 13, flex: 1 },
  cta: { marginTop: 10 },
  loginLink: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 24 },
  loginText: { fontSize: 13 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  modalHandle: { width: 42, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 14 },
  modalTitle: { fontSize: 19, fontWeight: '900' },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  closeButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  form: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  textArea: { minHeight: 92, paddingTop: 12, textAlignVertical: 'top' },
  privacyText: { fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12, paddingHorizontal: 12 },
});
