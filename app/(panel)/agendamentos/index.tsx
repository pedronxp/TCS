import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  Alert, KeyboardAvoidingView, Platform, FlatList
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { supabase } from '../../../utils/supabase';
import {
  insertAgendamento,
  getAgendamentosByMunicipio,
  getAgendamentosByAgente,
  getAllAgendamentos,
  deleteAgendamento,
  deleteAgendamentoWithTombstone,
  markAgendamentoSincronizado,
} from '../../../utils/database';
import { generateUUID } from '../../../utils/uuid';
import { AgendamentoLocal } from '../../../types/agendamento';
import { AppHeader, Badge, Button, EmptyState, FormField, LoadingState, MetricCard, SectionHeader } from '../../../components/ui';
import { Spacing } from '../../../constants/Spacing';

interface AgentUser {
  uid: string;
  name: string;
  municipio?: string;
}

function formatDataAgendada(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function parseDateInput(input: string): string | null {
  // Aceita DD/MM/AAAA HH:MM
  const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, d, m, y, h, min] = match;
  // Validar sem converter para UTC — armazenar como horário local para evitar drift de fuso
  const test = new Date(`${y}-${m}-${d}T${h}:${min}:00`);
  if (isNaN(test.getTime())) return null;
  return `${y}-${m}-${d}T${h}:${min}:00`;
}

export default function AgendamentosScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile } = useAuth();
  const { isOnlineReal: isConnected } = useConnectivity();

  const [agendamentos, setAgendamentos] = useState<AgendamentoLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agentes, setAgentes] = useState<AgentUser[]>([]);
  const [agentesLoading, setAgentesLoading] = useState(false);

  // Form fields
  const [titulo, setTitulo] = useState('');
  const [endereco, setEndereco] = useState('');
  const [dataInput, setDataInput] = useState('');
  const [horaInput, setHoraInput] = useState('');
  const [dataErro, setDataErro] = useState<string | null>(null);
  const [agenteUid, setAgenteUid] = useState('');
  const [agenteSelecionado, setAgenteSelecionado] = useState<AgentUser | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [showAgentePicker, setShowAgentePicker] = useState(false);

  const canCreate = profile?.role === 'supervisor' || profile?.role === 'admin' || profile?.role === 'master_admin';
  const isAgent = profile?.role === 'agent';

  const getAgendamentosLocaisVisiveis = (): AgendamentoLocal[] => {
    if (!profile) return [];
    if (profile.role === 'master_admin') return getAllAgendamentos();
    if (isAgent) return getAgendamentosByAgente(profile.uid, profile.municipio);
    return getAgendamentosByMunicipio(profile.municipio ?? '');
  };

  const carregar = async (showRefresh = false) => {
    if (!profile) return;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      if (isConnected) {
        // Busca do Supabase
        let query = supabase.from('agendamentos').select('*').order('data_agendada', { ascending: true });

        if (profile.role === 'master_admin') {
          // vê todos
        } else if (isAgent) {
          query = query.or(`agente_uid.eq.${profile.uid},agente_uid.is.null`).eq('municipio', profile.municipio);
        } else {
          query = query.eq('municipio', profile.municipio);
        }

        const { data, error } = await query;
        if (!error && data) {
          // Salva localmente para offline
          const mapped: AgendamentoLocal[] = data.map((r: any) => ({
            id: r.id,
            titulo: r.titulo,
            endereco: r.endereco,
            municipio: r.municipio,
            data_agendada: r.data_agendada,
            criado_por_uid: r.criado_por_uid,
            criado_por_nome: r.criado_por_nome,
            agente_uid: r.agente_uid,
            agente_nome: r.agente_nome,
            lat: r.lat,
            lng: r.lng,
            observacoes: r.observacoes,
            status: r.status,
            origem: r.origem === 'web' ? 'web' : 'app',
            criado_em: r.criado_em,
            sincronizado: 1,
          }));
          // Nunca sobrescrever uma alteração local ainda pendente com uma cópia
          // antiga do servidor. Ela deve ser enviada pelo SyncService primeiro.
          const locais = getAgendamentosLocaisVisiveis();
          const pendentesPorId = new Map(
            locais.filter(a => a.sincronizado === 0).map(a => [a.id, a])
          );
          const idsRemotos = new Set(mapped.map(a => a.id));

          mapped.forEach(a => {
            if (!pendentesPorId.has(a.id)) insertAgendamento(a);
          });

          const mesclados = [
            ...mapped.map(a => pendentesPorId.get(a.id) ?? a),
            ...locais.filter(a => a.sincronizado === 0 && !idsRemotos.has(a.id)),
          ]
            .filter(a => a.status !== 'deletado')
            .sort((a, b) => a.data_agendada.localeCompare(b.data_agendada));
          setAgendamentos(mesclados);
        } else {
          // Fallback para SQLite
          carregarLocal();
        }
      } else {
        carregarLocal();
      }
    } catch {
      carregarLocal();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const carregarLocal = () => {
    setAgendamentos(getAgendamentosLocaisVisiveis().filter(a => a.status !== 'deletado'));
  };

  const carregarAgentes = async () => {
    setAgentesLoading(true);
    try {
      const { data } = await supabase.rpc('list_operational_users', {
        p_role: 'agent', p_municipio: null, p_include_unapproved: false, p_offset: 0, p_limit: 500,
      });
      if (data) setAgentes(data as AgentUser[]);
    } catch {
      // sem agentes
    } finally {
      setAgentesLoading(false);
    }
  };

  const handleDelete = (a: AgendamentoLocal) => {
    if (!canCreate) return;
    Alert.alert(
      'Excluir agendamento?',
      `"${a.titulo}" será removido permanentemente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              // Primeiro manter um tombstone local. Se a chamada remota falhar,
              // o SyncService a repete quando a conexão voltar.
              deleteAgendamentoWithTombstone(a.id);
              if (isConnected) {
                const { error } = await supabase.rpc('delete_operational_appointment', { p_id: a.id });
                if (!error) deleteAgendamento(a.id);
              }
              setAgendamentos(prev => prev.filter(x => x.id !== a.id));
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir o agendamento.');
            }
          },
        },
      ]
    );
  };

  useFocusEffect(useCallback(() => { carregar(); }, [profile]));

  const abrirModal = () => {
    setTitulo('');
    setEndereco('');
    setDataInput('');
    setHoraInput('');
    setDataErro(null);
    setAgenteUid('');
    setAgenteSelecionado(null);
    setObservacoes('');
    setShowAgentePicker(false);
    setModalVisible(true);
    carregarAgentes();
  };

  const handleDataChange = (text: string) => {
    const nums = text.replace(/\D/g, '').slice(0, 8);
    let formatted = nums;
    if (nums.length > 4) formatted = `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4)}`;
    else if (nums.length > 2) formatted = `${nums.slice(0, 2)}/${nums.slice(2)}`;
    setDataInput(formatted);
    setDataErro(null);
  };

  const handleHoraChange = (text: string) => {
    const nums = text.replace(/\D/g, '').slice(0, 4);
    let formatted = nums;
    if (nums.length > 2) formatted = `${nums.slice(0, 2)}:${nums.slice(2)}`;
    setHoraInput(formatted);
    setDataErro(null);
  };

  const salvarAgendamento = async () => {
    if (!titulo.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o título do agendamento.');
      return;
    }
    const dataISO = parseDateInput(`${dataInput} ${horaInput}`);
    if (!dataISO) {
      setDataErro('Data ou hora inválida. Use DD/MM/AAAA e HH:MM.');
      return;
    }
    if (!profile) return;

    // Para master_admin, usar o município do agente selecionado (se houver) ou deixar genérico
    const municipioAgendamento = profile.role === 'master_admin'
      ? (agenteSelecionado?.municipio ?? profile.municipio ?? '')
      : (profile.municipio ?? '');

    setSaving(true);
    try {
      const id = generateUUID();

      // Geocodificar o endereço via Nominatim (OpenStreetMap) para obter lat/lng
      let lat: number | undefined;
      let lng: number | undefined;
      const enderecoTexto = endereco.trim();
      if (enderecoTexto && isConnected) {
        try {
          const query = encodeURIComponent(`${enderecoTexto}, ${municipioAgendamento}, Brasil`);
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
            { headers: { 'User-Agent': 'TCS-RelatorioDeRisco/1.0' } }
          );
          const results = await resp.json();
          if (results?.[0]) {
            lat = parseFloat(results[0].lat);
            lng = parseFloat(results[0].lon);
          }
        } catch { /* geocodificação opcional — não bloqueia salvamento */ }
      }

      const agendamento: AgendamentoLocal = {
        id,
        titulo: titulo.trim(),
        endereco: enderecoTexto || undefined,
        municipio: municipioAgendamento,
        data_agendada: dataISO,
        criado_por_uid: profile.uid,
        criado_por_nome: profile.name,
        agente_uid: agenteSelecionado?.uid || undefined,
        agente_nome: agenteSelecionado?.name || undefined,
        lat,
        lng,
        observacoes: observacoes.trim() || undefined,
        status: 'pendente',
        origem: 'app',
        criado_em: new Date().toISOString(),
        sincronizado: 0,
      };

      // 1. Salva localmente
      insertAgendamento(agendamento);

      // 2. Tenta Supabase se online
      if (isConnected) {
        const { error } = await supabase.rpc('upsert_operational_appointment', {
          p_payload: {
            id: agendamento.id,
            titulo: agendamento.titulo,
            endereco: agendamento.endereco ?? null,
            municipio: agendamento.municipio,
            data_agendada: agendamento.data_agendada,
            agente_uid: agendamento.agente_uid ?? null,
            lat: agendamento.lat ?? null,
            lng: agendamento.lng ?? null,
            observacoes: agendamento.observacoes ?? null,
          },
        });
        if (!error) markAgendamentoSincronizado(agendamento.id);
      }

      setModalVisible(false);
      carregar();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar o agendamento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LoadingState message="Carregando agenda operacional..." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Agenda operacional"
        subtitle={`${agendamentos.length} tarefa${agendamentos.length !== 1 ? 's' : ''}`}
        onBack={() => router.back()}
        {...(canCreate ? {
          actionIcon: 'plus' as const,
          actionLabel: 'Novo agendamento',
          onAction: abrirModal,
        } : {})}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />
        }
      >
        <View style={styles.metrics}>
          <MetricCard
            value={agendamentos.filter(item => item.status === 'pendente').length}
            label="Pendentes"
            tone="warning"
            style={styles.metricCard}
          />
          <MetricCard
            value={agendamentos.filter(item => item.status === 'concluido').length}
            label="Concluídas"
            tone="success"
            style={styles.metricCard}
          />
        </View>
        <SectionHeader title="Próximas tarefas" subtitle="Toque em um agendamento para abrir os detalhes" />
        {agendamentos.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Nenhum agendamento"
            description={canCreate ? 'Crie a primeira tarefa para organizar a operação.' : 'Nenhuma tarefa foi atribuída a você.'}
            actionLabel={canCreate ? 'Novo agendamento' : undefined}
            onAction={canCreate ? abrirModal : undefined}
          />
        ) : (
          agendamentos.map(a => {
            const statusVariant = a.status === 'concluido' ? 'success' : a.status === 'cancelado' ? 'error' : a.status === 'pendente' ? 'warning' : 'neutral';
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => router.push(`/(panel)/agendamentos/${a.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTop}>
                  <Text style={[styles.cardTitulo, { color: theme.text }]} numberOfLines={2}>
                    {a.titulo}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {a.origem === 'web' && (
                      <View style={[styles.originBadge, { backgroundColor: `${theme.primary}18` }]}>
                        <Feather name="globe" size={11} color={theme.primary} />
                        <Text style={[styles.originText, { color: theme.primary }]}>FEITO NA WEB</Text>
                      </View>
                    )}
                    <Badge label={a.status === 'concluido' ? 'Concluída' : a.status === 'cancelado' ? 'Cancelada' : a.status === 'pendente' ? 'Pendente' : a.status} variant={statusVariant} size="sm" />
                    {canCreate && (
                      <TouchableOpacity
                        onPress={() => handleDelete(a)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="trash-2" size={15} color={theme.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={styles.cardMeta}>
                  <Feather name="clock" size={13} color={theme.textSecondary} />
                  <Text style={[styles.cardMetaText, { color: theme.textSecondary }]}>
                    {formatDataAgendada(a.data_agendada)}
                  </Text>
                </View>
                {a.endereco ? (
                  <View style={styles.cardMeta}>
                    <Feather name="map-pin" size={13} color={theme.textSecondary} />
                    <Text style={[styles.cardMetaText, { color: theme.textSecondary }]} numberOfLines={1}>
                      {a.endereco}
                    </Text>
                  </View>
                ) : null}
                {a.agente_nome ? (
                  <View style={styles.cardMeta}>
                    <Feather name="user" size={13} color={theme.textSecondary} />
                    <Text style={[styles.cardMetaText, { color: theme.textSecondary }]}>
                      {a.agente_nome}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.cardMeta}>
                    <Feather name="user" size={13} color={theme.textSecondary} />
                    <Text style={[styles.cardMetaText, { color: theme.textSecondary }]}>
                      Sem agente atribuído
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal de criação */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Novo Agendamento</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <FormField
                label="Título"
                required
                placeholder="Ex: Vistoria Rua das Flores, 42"
                value={titulo}
                onChangeText={setTitulo}
              />

              <FormField
                label="Endereço"
                placeholder="Rua, número, bairro"
                value={endereco}
                onChangeText={setEndereco}
              />

              {/* Data e hora */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Data e hora *</Text>
              <View style={styles.dataHoraRow}>
                <TextInput
                  style={[styles.input, styles.dataInput, { backgroundColor: theme.background, borderColor: dataErro ? theme.error : theme.border, color: theme.text }]}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={theme.textSecondary}
                  value={dataInput}
                  onChangeText={handleDataChange}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <TextInput
                  style={[styles.input, styles.horaInput, { backgroundColor: theme.background, borderColor: dataErro ? theme.error : theme.border, color: theme.text }]}
                  placeholder="HH:MM"
                  placeholderTextColor={theme.textSecondary}
                  value={horaInput}
                  onChangeText={handleHoraChange}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
              {dataErro ? (
                <Text style={[styles.fieldError, { color: theme.error }]}>{dataErro}</Text>
              ) : null}

              {/* Agente atribuído */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Agente atribuído</Text>
              <TouchableOpacity
                style={[styles.input, styles.pickerBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => setShowAgentePicker(!showAgentePicker)}
              >
                <Text style={{ color: agenteSelecionado ? theme.text : theme.textSecondary }}>
                  {agenteSelecionado ? agenteSelecionado.name : 'Selecionar agente (opcional)'}
                </Text>
                <Feather name={showAgentePicker ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} />
              </TouchableOpacity>

              {showAgentePicker && (
                <View style={[styles.pickerList, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  {agentesLoading ? (
                    <ActivityIndicator size="small" color={theme.primary} style={{ padding: 12 }} />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.pickerItem, { borderBottomColor: theme.border }]}
                        onPress={() => { setAgenteSelecionado(null); setAgenteUid(''); setShowAgentePicker(false); }}
                      >
                        <Text style={{ color: theme.textSecondary }}>Sem atribuição</Text>
                      </TouchableOpacity>
                      {agentes.map(ag => (
                        <TouchableOpacity
                          key={ag.uid}
                          style={[styles.pickerItem, { borderBottomColor: theme.border }]}
                          onPress={() => { setAgenteSelecionado(ag); setAgenteUid(ag.uid); setShowAgentePicker(false); }}
                        >
                          <Text style={{ color: theme.text }}>{ag.name}</Text>
                          {ag.municipio ? (
                            <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>{ag.municipio}</Text>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                      {agentes.length === 0 && !agentesLoading && (
                        <Text style={{ color: theme.textSecondary, padding: 12 }}>Nenhum agente disponível.</Text>
                      )}
                    </>
                  )}
                </View>
              )}

              <FormField
                label="Observações"
                placeholder="Informações adicionais..."
                value={observacoes}
                onChangeText={setObservacoes}
                multiline
                numberOfLines={4}
              />

              <Button
                label="Salvar agendamento"
                onPress={salvarAgendamento}
                loading={saving}
                fullWidth
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  scrollContent: { padding: Spacing[4], paddingBottom: 100 },
  metrics: { flexDirection: 'row', gap: Spacing[3], marginBottom: Spacing[5] },
  metricCard: { flex: 1, minHeight: 112 },

  emptyCard: {
    borderRadius: 20, borderWidth: 1, padding: 40,
    alignItems: 'center', marginTop: 40,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  card: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  cardTitulo: { fontSize: 15, fontWeight: '700', flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  originBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  originText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  cardMetaText: { fontSize: 12, fontWeight: '500', flex: 1 },

  fab: {
    position: 'absolute', bottom: 32, right: 24,
    width: 56, height: 56, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalContent: { padding: 20, paddingBottom: 40, gap: Spacing[4] },

  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderRadius: 12, padding: 14,
    fontSize: 15, fontWeight: '500',
  },
  textArea: { minHeight: 90 },
  dataHoraRow: { flexDirection: 'row', gap: 10 },
  dataInput: { flex: 2 },
  horaInput: { flex: 1 },
  fieldError: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerList: {
    borderWidth: 1, borderRadius: 12, marginTop: 4, overflow: 'hidden',
  },
  pickerItem: {
    padding: 14, borderBottomWidth: 1,
  },

  saveBtn: {
    marginTop: 24, borderRadius: 16, padding: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
