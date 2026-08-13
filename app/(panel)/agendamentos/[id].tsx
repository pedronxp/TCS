import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { supabase } from '../../../utils/supabase';
import {
  getAgendamentoById,
  updateAgendamentoStatus,
  markAgendamentoSincronizado,
  deleteAgendamentoWithTombstone,
} from '../../../utils/database';
import { AgendamentoLocal } from '../../../types/agendamento';
import { AppHeader, Badge, Button, EmptyState, LoadingState, StateBanner } from '../../../components/ui';
import { Spacing } from '../../../constants/Spacing';
import { TCSPalette } from '../../../constants/Colors';

const STATUS_LABELS = {
  pendente: 'Pendente',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  deletado: 'Deletado',
};

function formatDataExtensa(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDataSimples(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AgendamentoDetalheScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { isOnlineReal: isConnected } = useConnectivity();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [agendamento, setAgendamento] = useState<AgendamentoLocal | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const canAct = profile?.role === 'supervisor' || profile?.role === 'admin' || profile?.role === 'master_admin';

  const carregar = useCallback(() => {
    if (!id) return;
    setLoading(true);
    try {
      // Tenta buscar do SQLite local
      const local = getAgendamentoById(id);
      if (local) {
        setAgendamento(local);
        setLoading(false);
        return;
      }
      // Se não tem localmente e está online, busca do Supabase
      if (isConnected) {
        supabase
          .from('agendamentos')
          .select('*')
          .eq('id', id)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              const mapped: AgendamentoLocal = {
                id: data.id,
                titulo: data.titulo,
                endereco: data.endereco,
                municipio: data.municipio,
                data_agendada: data.data_agendada,
                criado_por_uid: data.criado_por_uid,
                criado_por_nome: data.criado_por_nome,
                agente_uid: data.agente_uid,
                agente_nome: data.agente_nome,
                lat: data.lat,
                lng: data.lng,
                observacoes: data.observacoes,
                status: data.status,
                origem: data.origem === 'web' ? 'web' : 'app',
                criado_em: data.criado_em,
                sincronizado: 1,
              };
              setAgendamento(mapped);
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [id, isConnected]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const executarAcao = async (novoStatus: 'concluido' | 'cancelado') => {
    if (!agendamento || !id) return;

    const label = novoStatus === 'concluido' ? 'concluído' : 'cancelado';
    Alert.alert(
      `Confirmar ação`,
      `Deseja marcar este agendamento como ${label}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: novoStatus === 'cancelado' ? 'destructive' : 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              // 1. Atualiza localmente
              updateAgendamentoStatus(id, novoStatus);

              // 2. Sincroniza com Supabase se online
              if (isConnected) {
                const { error } = await supabase.rpc('transition_operational_appointment', {
                  p_id: id,
                  p_status: novoStatus,
                  p_inspection_id: null,
                });
                if (!error) {
                  markAgendamentoSincronizado(id);
                }
              }

              // 3. Atualiza estado local
              setAgendamento(prev => prev ? { ...prev, status: novoStatus } : null);
            } catch {
              Alert.alert('Erro', 'Não foi possível atualizar o status. Tente novamente.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const excluirAgendamento = () => {
    Alert.alert(
      'Excluir agendamento?',
      'Esta ação não pode ser desfeita. O agendamento será removido permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              if (isConnected) {
                // Online: deletar diretamente no Supabase e remover local
                const { error } = await supabase.rpc('delete_operational_appointment', { p_id: id });
                if (error) throw error;
                // Remover registro local após confirmação remota
                const { deleteAgendamento } = require('../../../utils/database');
                deleteAgendamento(id as string);
              } else {
                // Offline: tombstone — SyncService fará o delete remoto ao reconectar
                deleteAgendamentoWithTombstone(id as string);
              }
              router.back();
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir o agendamento.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LoadingState message="Carregando agendamento..." />
      </View>
    );
  }

  if (!agendamento) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <AppHeader title="Agendamento" onBack={() => router.back()} style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }} />
        <EmptyState
          icon="calendar"
          title="Agendamento não encontrado"
          description="A tarefa pode ter sido removida ou ainda não estar disponível offline."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const statusVariant = agendamento.status === 'concluido' ? 'success' : agendamento.status === 'cancelado' ? 'error' : agendamento.status === 'pendente' ? 'warning' : 'neutral';
  const isPendente = agendamento.status === 'pendente';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Detalhe da tarefa"
        subtitle={formatDataSimples(agendamento.data_agendada)}
        onBack={() => router.back()}
        {...(canAct ? { actionIcon: 'trash-2' as const, actionLabel: 'Excluir agendamento', onAction: excluirAgendamento } : {})}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Título + badge de status */}
        <View style={styles.titleRow}>
          <Text style={[styles.titulo, { color: theme.text }]} selectable>
            {agendamento.titulo}
          </Text>
          <Badge label={STATUS_LABELS[agendamento.status] ?? agendamento.status} variant={statusVariant} showDot />
          {agendamento.origem === 'web' && (
            <View style={[styles.webBadge, { backgroundColor: `${theme.primary}18` }]}>
              <Feather name="globe" size={12} color={theme.primary} />
              <Text style={[styles.webBadgeText, { color: theme.primary }]}>FEITO NA WEB</Text>
            </View>
          )}
        </View>

        {/* Data e hora */}
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="clock" size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Data e hora agendada</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {formatDataExtensa(agendamento.data_agendada)}
              </Text>
            </View>
          </View>
        </View>

        {/* Endereço + município */}
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: theme.secondary }]}>
              <Feather name="map-pin" size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Localização</Text>
              {agendamento.endereco ? (
                <Text style={[styles.infoValue, { color: theme.text }]}>{agendamento.endereco}</Text>
              ) : (
                <Text style={[styles.infoPlaceholder, { color: theme.textSecondary }]}>Endereço não informado</Text>
              )}
              <Text style={[styles.infoSub, { color: theme.textSecondary }]}>{agendamento.municipio}</Text>
            </View>
          </View>
        </View>

        {/* Agente atribuído */}
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: theme.secondary }]}>
              <Feather name="user" size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Agente atribuído</Text>
              {agendamento.agente_nome ? (
                <Text style={[styles.infoValue, { color: theme.text }]}>{agendamento.agente_nome}</Text>
              ) : (
                <Text style={[styles.infoPlaceholder, { color: theme.textSecondary }]}>Sem agente atribuído</Text>
              )}
            </View>
          </View>
        </View>

        {/* Observações */}
        {agendamento.observacoes ? (
          <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: `${theme.primary}10` }]}>
                <Feather name="file-text" size={16} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Observações</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{agendamento.observacoes}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Criado por + data */}
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: theme.successLight }]}>
              <Feather name="edit-3" size={16} color={theme.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Criado por</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {agendamento.criado_por_nome ?? 'Desconhecido'}
              </Text>
              {agendamento.criado_em ? (
                <Text style={[styles.infoSub, { color: theme.textSecondary }]}>
                  {formatDataSimples(agendamento.criado_em)}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Indicador offline */}
        {!agendamento.sincronizado && (
          <StateBanner
            variant="warning"
            title="Pendente de sincronização"
            description="As alterações estão salvas neste aparelho e serão enviadas quando houver conexão."
          />
        )}

        {/* Botões de ação — apenas para supervisor/admin/master */}
        {canAct && isPendente && (
          <View style={styles.actionsRow}>
            <Button
              label="Concluir"
              onPress={() => executarAcao('concluido')}
              loading={actionLoading}
              iconLeft={<Feather name="check-circle" size={18} color={theme.onPrimary} />}
              style={styles.actionButton}
            />
            <Button
              label="Cancelar"
              variant="danger"
              onPress={() => executarAcao('cancelado')}
              disabled={actionLoading}
              iconLeft={<Feather name="x-circle" size={18} color={theme.onPrimary} />}
              style={styles.actionButton}
            />
          </View>
        )}

        {/* Iniciar Vistoria — para o agente atribuído */}
        {profile?.role === 'agent' && agendamento.agente_uid === profile.uid && isPendente && (
          <Button
            label="Iniciar vistoria"
            onPress={() => router.push({
              pathname: '/(panel)/inspecoes/dados-iniciais',
              params: {
                agendamentoId: agendamento.id,
                ruaPreenchida: agendamento.endereco ?? '',
                latPreenchida: agendamento.lat?.toString() ?? '',
                lngPreenchida: agendamento.lng?.toString() ?? '',
                municipioPreenchido: agendamento.municipio ?? '',
              },
            })}
            iconLeft={<Feather name="clipboard" size={18} color={theme.onPrimary} />}
            fullWidth
          />
        )}

        {/* Status final */}
        {!isPendente && (
          <StateBanner
            variant={agendamento.status === 'concluido' ? 'success' : 'danger'}
            title={`Agendamento ${STATUS_LABELS[agendamento.status]?.toLowerCase()}`}
            description="Este status está registrado no histórico operacional."
          />
        )}
      </ScrollView>
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
  deleteBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  scrollContent: { padding: Spacing[4], paddingBottom: Spacing[8], gap: Spacing[3] },

  titleRow: { marginBottom: 20, gap: 10 },
  titulo: { fontSize: 22, fontWeight: '800', lineHeight: 30 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  webBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  webBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  infoCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  infoIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  infoLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  infoSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  infoPlaceholder: { fontSize: 14, fontStyle: 'italic' },

  offlineBadge: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 10,
    borderWidth: 1, padding: 10, marginBottom: 16,
  },

  actionsRow: { gap: 10, marginTop: 8 },
  actionButton: { width: '100%' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, padding: 18,
  },
  actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  finalStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 8,
  },
  finalStatusText: { fontSize: 15, fontWeight: '700' },

  iniciarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, padding: 18, marginTop: 8,
  },
  iniciarBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
