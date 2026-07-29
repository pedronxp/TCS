import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert
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

const STATUS_COLORS = {
  pendente: { bg: 'rgba(59,130,246,0.12)', text: '#3B82F6' },
  concluido: { bg: 'rgba(16,185,129,0.12)', text: '#10B981' },
  cancelado: { bg: 'rgba(239,68,68,0.12)', text: '#EF4444' },
  deletado: { bg: 'rgba(100,116,139,0.12)', text: '#64748B' },
};

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
                const { error } = await supabase
                  .from('agendamentos')
                  .update({ status: novoStatus })
                  .eq('id', id);
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
                await supabase.from('agendamentos').delete().eq('id', id);
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
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!agendamento) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Agendamento</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Feather name="alert-circle" size={48} color={theme.textSecondary} style={{ opacity: 0.4, marginBottom: 16 }} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Agendamento não encontrado</Text>
          <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
            Este agendamento pode ter sido removido ou não está disponível offline.
          </Text>
        </View>
      </View>
    );
  }

  const statusColors = STATUS_COLORS[agendamento.status] ?? STATUS_COLORS.pendente;
  const isPendente = agendamento.status === 'pendente';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Detalhe</Text>
        {canAct ? (
          <TouchableOpacity
            onPress={excluirAgendamento}
            style={styles.deleteBtn}
            disabled={actionLoading}
          >
            <Feather name="trash-2" size={18} color="#EF4444" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Título + badge de status */}
        <View style={styles.titleRow}>
          <Text style={[styles.titulo, { color: theme.text }]} selectable>
            {agendamento.titulo}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {STATUS_LABELS[agendamento.status]?.toUpperCase() ?? agendamento.status.toUpperCase()}
            </Text>
          </View>
          {agendamento.origem === 'web' && (
            <View style={[styles.webBadge, { backgroundColor: `${theme.primary}18` }]}>
              <Feather name="globe" size={12} color={theme.primary} />
              <Text style={[styles.webBadgeText, { color: theme.primary }]}>FEITO NA WEB</Text>
            </View>
          )}
        </View>

        {/* Data e hora */}
        <View style={[styles.infoCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
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
        <View style={[styles.infoCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Feather name="map-pin" size={16} color="#F59E0B" />
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
        <View style={[styles.infoCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
              <Feather name="user" size={16} color="#8B5CF6" />
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
          <View style={[styles.infoCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
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
        <View style={[styles.infoCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
              <Feather name="edit-3" size={16} color="#10B981" />
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
          <View style={[styles.offlineBadge, { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }]}>
            <Feather name="wifi-off" size={14} color="#F59E0B" />
            <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600', marginLeft: 6 }}>
              Pendente de sincronização
            </Text>
          </View>
        )}

        {/* Botões de ação — apenas para supervisor/admin/master */}
        {canAct && isPendente && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSuccess]}
              onPress={() => executarAcao('concluido')}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Feather name="check-circle" size={18} color="#FFF" />
                  <Text style={styles.actionBtnText}>Marcar como Concluído</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => executarAcao('cancelado')}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              <Feather name="x-circle" size={18} color="#FFF" />
              <Text style={styles.actionBtnText}>Cancelar Agendamento</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Iniciar Vistoria — para o agente atribuído */}
        {profile?.role === 'agent' && agendamento.agente_uid === profile.uid && isPendente && (
          <TouchableOpacity
            style={[styles.iniciarBtn, { backgroundColor: theme.primary }]}
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
            activeOpacity={0.85}
          >
            <Feather name="clipboard" size={18} color="#FFF" />
            <Text style={styles.iniciarBtnText}>Iniciar Vistoria</Text>
          </TouchableOpacity>
        )}

        {/* Status final */}
        {!isPendente && (
          <View style={[styles.finalStatus, { backgroundColor: statusColors.bg, borderColor: statusColors.text + '40' }]}>
            <Feather
              name={agendamento.status === 'concluido' ? 'check-circle' : 'x-circle'}
              size={20}
              color={statusColors.text}
            />
            <Text style={[styles.finalStatusText, { color: statusColors.text }]}>
              Agendamento {STATUS_LABELS[agendamento.status]?.toLowerCase()}
            </Text>
          </View>
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
  scrollContent: { padding: 20, paddingBottom: 60 },

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
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, padding: 18,
  },
  actionBtnSuccess: { backgroundColor: '#10B981' },
  actionBtnDanger: { backgroundColor: '#EF4444' },
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
