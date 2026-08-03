import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { COMMERCIAL_PLANS, formatPlanPrice } from '../../../constants/CommercialPlans';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, Button, EmptyState, FormField, MetricCard } from '../../../components/ui';

type RequestStatus = 'pending' | 'contacted' | 'awaiting_account' | 'approved' | 'rejected' | 'canceled';
type ReviewAction = 'contacted' | 'approve' | 'reject';

interface PurchaseRequest {
  id: string;
  requester_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  organization_name: string | null;
  municipality_name: string | null;
  billing_cycle: 'monthly' | 'annual' | 'custom';
  status: RequestStatus;
  customer_message: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  plans: { code: string; name: string; audience: string } | { code: string; name: string; audience: string }[];
}

const STATUS_CONFIG: Record<RequestStatus, { label: string; tone: 'primary' | 'success' | 'warning' | 'danger' | 'muted'; icon: keyof typeof Feather.glyphMap }> = {
  pending: { label: 'Pendente', tone: 'warning', icon: 'clock' },
  contacted: { label: 'Em contato', tone: 'primary', icon: 'phone-call' },
  awaiting_account: { label: 'Aguardando conta', tone: 'primary', icon: 'user-plus' },
  approved: { label: 'Ativado', tone: 'success', icon: 'check-circle' },
  rejected: { label: 'Recusado', tone: 'danger', icon: 'x-circle' },
  canceled: { label: 'Cancelado', tone: 'muted', icon: 'slash' },
};

const ACTION_LABEL: Record<ReviewAction, string> = {
  contacted: 'Marcar contato iniciado',
  approve: 'Ativar plano',
  reject: 'Recusar solicitação',
};

export default function ContractRequestsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'open' | 'approved' | 'rejected' | 'all'>('open');
  const [reviewTarget, setReviewTarget] = useState<PurchaseRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction>('contacted');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const loadRequests = useCallback(async (asRefresh = false) => {
    if (profile?.role !== 'master_admin') return;
    if (asRefresh) setRefreshing(true);
    else setLoading(true);

    const { data, error } = await supabase
      .from('plan_purchase_requests')
      .select('id, requester_id, contact_name, contact_email, contact_phone, organization_name, municipality_name, billing_cycle, status, customer_message, review_note, created_at, reviewed_at, plans(code, name, audience)')
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Contratações indisponíveis', 'Não foi possível carregar as solicitações. Confirme se a migration foi aplicada.');
    } else {
      setRequests((data as unknown as PurchaseRequest[]) || []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [profile?.role]);

  useFocusEffect(useCallback(() => {
    loadRequests();
  }, [loadRequests]));

  const filtered = useMemo(() => requests.filter(request => {
    if (filter === 'open') return ['pending', 'contacted', 'awaiting_account'].includes(request.status);
    if (filter === 'approved') return request.status === 'approved';
    if (filter === 'rejected') return ['rejected', 'canceled'].includes(request.status);
    return true;
  }), [filter, requests]);

  const beginReview = (request: PurchaseRequest, action: ReviewAction) => {
    setReviewTarget(request);
    setReviewAction(action);
    setReviewNote(request.review_note || '');
  };

  const closeReview = () => {
    if (reviewing) return;
    setReviewTarget(null);
    setReviewNote('');
  };

  const performReview = async () => {
    if (!reviewTarget) return;
    setReviewing(true);
    const { data, error } = await supabase.rpc('review_plan_purchase_request', {
      p_request_id: reviewTarget.id,
      p_action: reviewAction,
      p_review_note: reviewNote.trim() || null,
    });
    setReviewing(false);

    if (error) {
      Alert.alert('Ação não concluída', 'Não foi possível atualizar esta contratação. Verifique sua permissão e tente novamente.');
      return;
    }

    closeReview();
    await loadRequests(true);

    if (data?.reason === 'account_required') {
      Alert.alert('Aguardando cadastro', 'O contato ainda não possui uma conta aprovada. Envie um token de acesso e tente ativar novamente após o cadastro.');
    } else if (data?.reason === 'organization_member_requires_municipal_plan') {
      Alert.alert('Plano incompatível', 'Este usuário já pertence a uma organização. Selecione um plano municipal para essa conta.');
    } else if (data?.approved) {
      Alert.alert('Plano ativado', 'A assinatura foi criada e já aparece na conta do contratante.');
    }
  };

  const filterOptions: { key: typeof filter; label: string }[] = [
    { key: 'open', label: 'Em aberto' },
    { key: 'approved', label: 'Ativadas' },
    { key: 'rejected', label: 'Encerradas' },
    { key: 'all', label: 'Todas' },
  ];
  const abertas = requests.filter(request => ['pending', 'contacted', 'awaiting_account'].includes(request.status)).length;
  const aprovadas = requests.filter(request => request.status === 'approved').length;
  const encerradas = requests.filter(request => ['rejected', 'canceled'].includes(request.status)).length;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader title="Contratações" subtitle="Análise e ativação manual de planos" onBack={() => router.back()} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
        <MetricCard value={abertas} label="Em aberto" tone="warning" style={styles.metricCard} />
        <MetricCard value={aprovadas} label="Ativadas" tone="success" style={styles.metricCard} />
        <MetricCard value={encerradas} label="Encerradas" tone="danger" style={styles.metricCard} />
      </ScrollView>

      <View style={[styles.filters, { borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {filterOptions.map(option => (
            <TouchableOpacity
              key={option.key}
              style={[styles.filter, { borderColor: filter === option.key ? theme.primary : theme.border, backgroundColor: filter === option.key ? theme.primaryLight : theme.surface }]}
              onPress={() => setFilter(option.key)}
            >
              <Text style={[styles.filterText, { color: filter === option.key ? theme.primaryText : theme.textSecondary }]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} color={theme.primary} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} tintColor={theme.primary} />}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        >
          {filtered.length === 0 && (
            <EmptyState icon="inbox" title="Nenhuma solicitação" description="Os pedidos enviados pela vitrine de planos aparecerão aqui." />
          )}

          {filtered.map(request => {
            const planRelation = Array.isArray(request.plans) ? request.plans[0] : request.plans;
            const plan = COMMERCIAL_PLANS.find(item => item.code === planRelation?.code);
            const baseStatus = STATUS_CONFIG[request.status];
            const status = {
              ...baseStatus,
              color: baseStatus.tone === 'success' ? theme.success : baseStatus.tone === 'warning' ? theme.warning : baseStatus.tone === 'danger' ? theme.error : baseStatus.tone === 'muted' ? theme.muted : theme.primary,
            };
            const price = plan
              ? request.billing_cycle === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents
              : null;
            const open = ['pending', 'contacted', 'awaiting_account'].includes(request.status);
            return (
              <View key={request.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, { color: theme.text }]}>{planRelation?.name || 'Plano TCS'}</Text>
                    <Text style={[styles.date, { color: theme.textSecondary }]}>{new Date(request.created_at).toLocaleString('pt-BR')}</Text>
                  </View>
                  <View style={[styles.status, { backgroundColor: `${status.color}18`, borderColor: `${status.color}55` }]}>
                    <Feather name={status.icon} size={12} color={status.color} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                <View style={[styles.priceBox, { backgroundColor: theme.surfaceVariant }]}>
                  <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>CONDIÇÃO</Text>
                  <Text style={[styles.priceValue, { color: theme.text }]}>
                    {request.billing_cycle === 'custom' ? 'Sob contrato' : `${price ? formatPlanPrice(price) : '—'} / ${request.billing_cycle === 'annual' ? 'ano' : 'mês'}`}
                  </Text>
                </View>

                <View style={styles.contactBlock}>
                  <Text style={[styles.contactName, { color: theme.text }]}>{request.contact_name}</Text>
                  {(request.organization_name || request.municipality_name) && (
                    <Text style={[styles.organization, { color: theme.textSecondary }]}>{[request.organization_name, request.municipality_name].filter(Boolean).join(' · ')}</Text>
                  )}
                  <View style={styles.contactActions}>
                    <TouchableOpacity style={[styles.contactButton, { borderColor: theme.border }]} onPress={() => Linking.openURL(`mailto:${request.contact_email}`)}>
                      <Feather name="mail" size={15} color={theme.primary} />
                      <Text style={[styles.contactText, { color: theme.text }]} numberOfLines={1}>{request.contact_email}</Text>
                    </TouchableOpacity>
                    {request.contact_phone && (
                      <TouchableOpacity style={[styles.contactButton, { borderColor: theme.border }]} onPress={() => Linking.openURL(`tel:${request.contact_phone}`)}>
                        <Feather name="phone" size={15} color={theme.primary} />
                        <Text style={[styles.contactText, { color: theme.text }]}>{request.contact_phone}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {request.customer_message && <Text style={[styles.message, { color: theme.textSecondary, backgroundColor: theme.surfaceVariant }]}>{request.customer_message}</Text>}
                {request.review_note && <Text style={[styles.reviewNote, { color: theme.textSecondary }]}>Nota interna: {request.review_note}</Text>}

                {open && (
                  <View style={styles.actions}>
                    {request.status === 'pending' && (
                      <TouchableOpacity style={[styles.action, { borderColor: theme.border }]} onPress={() => beginReview(request, 'contacted')}>
                        <Feather name="phone-call" size={16} color={theme.primary} />
                        <Text style={[styles.actionLabel, { color: theme.text }]}>Contato</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.action, { backgroundColor: theme.successLight, borderColor: theme.success }]} onPress={() => beginReview(request, 'approve')}>
                      <Feather name="check" size={16} color={theme.success} />
                      <Text style={[styles.actionLabel, { color: theme.successText }]}>Ativar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.action, { backgroundColor: theme.errorLight, borderColor: theme.error }]} onPress={() => beginReview(request, 'reject')}>
                      <Feather name="x" size={16} color={theme.error} />
                      <Text style={[styles.actionLabel, { color: theme.errorText }]}>Recusar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!reviewTarget} transparent animationType="fade" onRequestClose={closeReview}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIcon, { backgroundColor: reviewAction === 'reject' ? theme.errorLight : theme.primaryLight }]}>
              <Feather name={reviewAction === 'approve' ? 'check-circle' : reviewAction === 'reject' ? 'x-circle' : 'phone-call'} size={26} color={reviewAction === 'reject' ? theme.error : theme.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{ACTION_LABEL[reviewAction]}</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>
              {reviewAction === 'approve'
                ? 'A assinatura será ativada manualmente. Para uma prefeitura nova, a organização será criada automaticamente.'
                : 'Registre uma observação interna para manter o histórico comercial.'}
            </Text>
            <FormField
              label="Observação interna"
              value={reviewNote}
              onChangeText={value => setReviewNote(value.slice(0, 1000))}
              placeholder="Observação interna (opcional)"
              multiline
              helperText="Opcional · máximo de 1.000 caracteres"
            />
            <View style={styles.modalActions}>
              <Button label="Cancelar" variant="ghost" onPress={closeReview} disabled={reviewing} style={styles.modalButton} />
              <Button label="Confirmar" variant={reviewAction === 'reject' ? 'danger' : 'primary'} onPress={performReview} disabled={reviewing} loading={reviewing} style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  metricsRow: { gap: 10, padding: 16 },
  metricCard: { width: 120 },
  filters: { paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1 },
  filter: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 },
  filterText: { fontSize: 11, fontWeight: '800' },
  content: { padding: 16, gap: 13 },
  card: { borderWidth: 1, borderRadius: 18, padding: 17 },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  planName: { fontSize: 18, fontWeight: '900' },
  date: { fontSize: 10, marginTop: 3 },
  status: { flexDirection: 'row', gap: 5, alignItems: 'center', borderRadius: 99, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { fontSize: 9, fontWeight: '900' },
  priceBox: { borderRadius: 11, padding: 11, marginTop: 14 },
  priceLabel: { fontSize: 8, letterSpacing: 1, fontWeight: '900' },
  priceValue: { fontSize: 14, fontWeight: '900', marginTop: 3 },
  contactBlock: { marginTop: 15 },
  contactName: { fontSize: 15, fontWeight: '900' },
  organization: { fontSize: 11, marginTop: 2 },
  contactActions: { gap: 7, marginTop: 10 },
  contactButton: { minHeight: 39, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, flexDirection: 'row', gap: 8, alignItems: 'center' },
  contactText: { flex: 1, fontSize: 12, fontWeight: '600' },
  message: { borderRadius: 10, padding: 11, fontSize: 12, lineHeight: 18, marginTop: 12 },
  reviewNote: { fontSize: 11, fontStyle: 'italic', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  action: { minHeight: 42, flex: 1, borderWidth: 1, borderRadius: 11, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  actionLabel: { fontSize: 11, fontWeight: '900' },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', maxWidth: 500, borderRadius: 20, padding: 20 },
  modalIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 19, fontWeight: '900', marginTop: 14 },
  modalText: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalButton: { flex: 1 },
});
