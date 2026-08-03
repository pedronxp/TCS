import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Modal, FlatList,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { countAgendamentosPendentes } from '../../../utils/database';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { DashboardGuide } from '../../../components/DashboardGuide';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { tempoRelativo } from '../../../utils/htmlUtils';
import { resolverApresentacaoRisco } from '../../../utils/riscoUtils';
import { VistoriaNormalizada } from '../../../types/vistoria';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { notificarVistoriaDeletada } from '../../../services/NotificationService';
import { registrarAuditoria } from '../../../utils/auditLogger';
import { isTrainingClassEnded, listTrainingClasses } from '../../../services/TrainingService';
import { MetricCard, SectionHeader, StateBanner } from '../../../components/ui';
import { TCSPalette } from '../../../constants/Colors';

export default function MasterDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile, developerMode, localTestMode } = useAuth();
  const { isConnected } = useConnectivity();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(false);
  const [stats, setStats] = useState({
    totalVistorias: 0, altoRisco: 0,
    totalUsuarios: 0, totalMunicipios: 0,
  });
  const [municipios, setMunicipios] = useState<{ nome: string; count: number }[]>([]);
  const [recentLogs, setRecentLogs] = useState<VistoriaNormalizada[]>([]);
  const [rankingGlobal, setRankingGlobal] = useState<{ nome: string; municipio: string; count: number }[]>([]);
  const [pendingAgendamentos, setPendingAgendamentos] = useState(0);
  const [riskModalVisible, setRiskModalVisible] = useState(false);
  const [riskByCidade, setRiskByCidade] = useState<{ municipio: string; alto: number; baixo: number }[]>([]);
  const [riskLoading, setRiskLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VistoriaNormalizada | null>(null);
  const [deleteMotivo, setDeleteMotivo] = useState('');
  const [deletando, setDeletando] = useState(false);
  const [trainingSummary, setTrainingSummary] = useState({
    classes: 0,
    participants: 0,
    limit: 0,
    nextEnd: null as string | null,
  });

  const carregar = async (showRefresh = false) => {
    setErro(false);
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [kpisRes, municipiosRes, logsRes] = await Promise.all([
        supabase.rpc('get_dashboard_kpis_master'),
        supabase.rpc('get_top_municipios', { p_limit: 10 }),
        supabase.from('vistorias')
          .select('id, nivelRisco, pontuacaoTotal, calculoRisco, endereco, municipio, dataVistoria, agenteNome, agenteUid, respostasJson, formularioId, status')
          .order('dataVistoria', { ascending: false })
          .limit(6),
      ]);

      if (kpisRes.data) {
        const k = kpisRes.data as any;
        setStats({
          totalVistorias: k.totalVistorias || 0,
          altoRisco: k.altoRisco || 0,
          totalUsuarios: k.totalUsuarios || 0,
          totalMunicipios: k.totalMunicipios || 0,
        });
      }
      if (municipiosRes.data) {
        setMunicipios((municipiosRes.data as any[]) || []);
      }
      if (logsRes.data) {
        setRecentLogs(logsRes.data || []);
      }

      // Top agentes globais do mês
      const inicioMes = new Date();
      inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
      const { data: rankData } = await supabase
        .from('vistorias')
        .select('agenteNome, municipio')
        .gte('dataVistoria', inicioMes.toISOString())
        .limit(500);
      if (rankData) {
        const contagem: Record<string, { count: number; municipio: string }> = {};
        rankData.forEach((v: any) => {
          const n = v.agenteNome || '?';
          if (!contagem[n]) contagem[n] = { count: 0, municipio: v.municipio || '' };
          contagem[n].count++;
        });
        setRankingGlobal(
          Object.entries(contagem)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([nome, d]) => ({ nome, municipio: d.municipio, count: d.count }))
        );
      }

      const trainings = await listTrainingClasses().catch((e) => {
        logger.warn('system', 'Resumo de treinamentos indisponível', { erro: String(e) });
        return [];
      });
      const abertas = trainings.filter(t => !isTrainingClassEnded(t));
      const proxima = [...abertas].sort((a, b) => new Date(a.fim_em).getTime() - new Date(b.fim_em).getTime())[0];
      setTrainingSummary({
        classes: abertas.length,
        participants: abertas.reduce((sum, t) => sum + (t.participant_count || 0), 0),
        limit: abertas.reduce((sum, t) => sum + t.limite_participantes, 0),
        nextEnd: proxima?.fim_em || null,
      });
    } catch (e) {
      logger.error('system', 'Erro master dashboard', { erro: String(e) });
      setErro(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const abrirRiskModal = async () => {
    setRiskModalVisible(true);
    if (riskByCidade.length > 0) return; // já carregado
    setRiskLoading(true);
    try {
      const { data } = await supabase.rpc('get_risk_by_municipio');
      if (data) {
        setRiskByCidade(data as { municipio: string; alto: number; baixo: number }[]);
      }
    } catch {
      // fallback: usar dados dos top municípios já carregados
    } finally {
      setRiskLoading(false);
    }
  };

  const confirmarDelete = async () => {
    if (!deleteTarget || !deleteMotivo.trim()) return;
    if (localTestMode) {
      Alert.alert(
        'Simulação concluída',
        'A conta Desenvolvedor pode testar esta confirmação, mas nenhuma vistoria oficial é excluída.'
      );
      setDeleteTarget(null);
      setDeleteMotivo('');
      return;
    }
    setDeletando(true);
    try {
      const { error } = await supabase.from('vistorias').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      // Notificar agente + equipe do município
      await notificarVistoriaDeletada(
        (deleteTarget as any).agenteUid || '',
        deleteTarget.agenteNome || '—',
        deleteTarget.municipio || '',
        deleteTarget.endereco || '',
        deleteMotivo.trim(),
        profile?.name || 'Master Admin',
      );

      // Auditoria
      registrarAuditoria({
        acao: 'vistoria_excluida',
        adminUid: profile?.uid || '',
        adminNome: profile?.name || 'Master Admin',
        adminRole: 'master_admin',
        municipio: deleteTarget.municipio || '',
        alvoId: deleteTarget.id,
        detalhes: { motivo: deleteMotivo.trim(), endereco: deleteTarget.endereco },
      });

      setDeleteTarget(null);
      setDeleteMotivo('');
      // Recarregar dashboard completo para manter KPIs, ranking e distribuição consistentes
      await carregar(true);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível excluir a vistoria. Tente novamente.');
      logger.error('system', 'Erro ao excluir vistoria', { erro: String(e) });
    } finally {
      setDeletando(false);
    }
  };

  useFocusEffect(useCallback(() => {
    carregar();
    if (profile?.municipio) {
      setPendingAgendamentos(countAgendamentosPendentes(profile.municipio));
    }
  }, [profile?.municipio]));

  if (loading) {
    return <LoadingState message="Carregando painel principal..." />;
  }


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.text }]} numberOfLines={1}>
            Olá, {profile?.name?.split(' ')[0]}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.chipBadge, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}25` }]}>
              <Feather name={developerMode ? 'code' : 'shield'} size={10} color={theme.primary} />
              <Text style={[styles.chipText, { color: theme.primary }]}>
                {developerMode ? 'Desenvolvedor' : 'Master'}
              </Text>
            </View>
            {isConnected ? (
              <View style={[styles.chipBadge, { backgroundColor: theme.successLight, borderColor: theme.success }]}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.success }} />
                <Text style={[styles.chipText, { color: theme.success }]}>Conectado</Text>
              </View>
            ) : (
              <View style={[styles.chipBadge, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)' }]}>
                <Feather name="wifi-off" size={10} color={theme.warning} />
                <Text style={[styles.chipText, { color: theme.warning }]}>Offline</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.headerActions}>
          <View>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
              onPress={() => router.push('/(panel)/agendamentos')}
            >
              <Feather name="calendar" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
            {pendingAgendamentos > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingAgendamentos > 9 ? '9+' : pendingAgendamentos}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
            onPress={() => router.push('/(panel)/perfil')}
          >
            <Feather name="user" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        {developerMode && (
          <StateBanner
            variant="info"
            title="Ambiente desenvolvedor"
            description="Acesso superior à Master. Os dados criados nesta sessão são temporários e não alteram o sistema oficial."
          />
        )}
        {!isConnected && (
          <StateBanner
            variant="warning"
            title="Modo offline ativo"
            description="O painel global está indisponível, mas os dados locais continuam acessíveis."
          />
        )}

        {/* Alerta global alto risco */}
        {stats.altoRisco > 0 && (
          <StateBanner
            variant="danger"
            title={`${stats.altoRisco} ${stats.altoRisco > 1 ? 'alertas críticos globais' : 'alerta crítico global'}`}
            description="Existem vistorias de alto risco que exigem acompanhamento."
            actionLabel="Ver vistorias"
            onAction={() => router.push('/(panel)/inspecoes')}
          />
        )}

        {erro && !loading && stats.totalVistorias === 0 && (
          <ErrorState
            title="Erro ao carregar dados"
            message="Não foi possível buscar as estatísticas globais. Puxe para atualizar."
            onRetry={() => carregar()}
          />
        )}
        <SectionHeader
          title="Visão global"
          subtitle="Cobertura, pessoas e atividade da rede TCS"
        />
        <View style={styles.metricGrid}>
          <MetricCard
            value={stats.totalVistorias}
            label="Vistorias da rede"
            detail="Base consolidada"
            tone="primary"
            style={styles.metricWide}
          />
          <MetricCard value={stats.altoRisco} label="Alto risco" tone="danger" style={styles.metricHalf} />
          <MetricCard value={stats.totalUsuarios} label="Usuários ativos" tone="success" style={styles.metricHalf} />
          <MetricCard value={stats.totalMunicipios} label="Municípios" tone="primary" style={styles.metricHalf} />
          <MetricCard value={trainingSummary.classes} label="Turmas abertas" tone="warning" style={styles.metricHalf} />
        </View>

        <TouchableOpacity
          style={[styles.trainingCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
          onPress={() => router.push('/(panel)/master/treinamentos')}
          activeOpacity={0.85}
        >
          <View style={[styles.trainingIcon, { backgroundColor: theme.successLight }]}>
            <Feather name="users" size={20} color={theme.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.trainingTitle, { color: theme.text }]}>Treinamentos</Text>
            <Text style={[styles.trainingDesc, { color: theme.textSecondary }]}>
              {trainingSummary.classes > 0
                ? `${trainingSummary.participants}/${trainingSummary.limit} alunos conectados`
                : 'Nenhuma turma ativa ou agendada'}
            </Text>
            {trainingSummary.nextEnd && (
              <Text style={[styles.trainingDeadline, { color: theme.success }]}>
                Expira em {new Date(trainingSummary.nextEnd).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            )}
          </View>
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        </TouchableOpacity>

        {/* Módulo de Equipe Unificado */}
        <View style={[styles.sectionRow, { marginTop: 8 }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginBottom: 0 }]}>Desempenho Geral</Text>
          <TouchableOpacity onPress={() => router.push('/(panel)/equipe')}>
            <Text style={[styles.seeAll, { color: theme.primary }]}>Ver equipe completa</Text>
          </TouchableOpacity>
        </View>

        {/* Atividade Recente */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 16 }]}>Registro de Operações</Text>
        {recentLogs.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Sem registros recentes.</Text>
          </View>
        ) : (
          recentLogs.map(v => {
            const apresentacao = resolverApresentacaoRisco({ formularioId: v.formularioId, pontuacao: v.pontuacaoTotal, nivelRisco: v.nivelRisco, calculoRisco: v.calculoRisco });
            const nivel = String(v.nivelRisco || '').toLowerCase();
            const cor = ['r3', 'r4', 'alto', 'critico', 'iminente'].includes(nivel)
              ? theme.error
              : ['r2', 'medio', 'médio'].includes(nivel) ? theme.warning : theme.success;
            return (
              <View
                key={v.id}
                style={[styles.vistoriaCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              >
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  onPress={() => router.push(`/(panel)/inspecoes/${v.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.riscoDot, { backgroundColor: `${cor}20`, borderColor: `${cor}40` }]}>
                    <Feather
                      name={cor === theme.error ? 'alert-triangle' : cor === theme.warning ? 'alert-circle' : 'check-circle'}
                      size={20} color={cor}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.vistoriaEnd, { color: theme.text }]} numberOfLines={1}>
                      {v.endereco || 'Endereço não informado'}
                    </Text>
                    <Text style={[styles.vistoriaInfo, { color: theme.textSecondary }]}>
                      {v.agenteNome || '?'} • {v.municipio} • {tempoRelativo(v.dataVistoria)}
                    </Text>
                  </View>
                  <View style={[styles.nivelBadge, { backgroundColor: `${cor}20` }]}>
                    <Text style={[styles.nivelText, { color: cor }]}>
                      {v.formularioId === 'avaliacao_arvore_cbmmg_v1' ? apresentacao.label : (v.nivelRisco?.toUpperCase() || '—')}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteBtn, { backgroundColor: theme.errorLight }]}
                  onPress={() => { setDeleteTarget(v); setDeleteMotivo(''); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="trash-2" size={16} color={theme.error} />
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* Barra de Risco Global */}
        {(stats.totalVistorias > 0) && (
          <TouchableOpacity
            style={[styles.riskDistributionCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
            onPress={abrirRiskModal}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={[styles.riskCardTitle, { color: theme.text }]}>Distribuição de Risco</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.riskCardSubtitle, { color: theme.textSecondary }]}>{stats.totalVistorias} laudos</Text>
                <Feather name="chevron-down" size={14} color={theme.textSecondary} />
              </View>
            </View>
            <View style={styles.riskBarContainer}>
              {stats.altoRisco > 0 && (
                <View style={[styles.riskSegment, { width: `${(stats.altoRisco / stats.totalVistorias) * 100}%`, backgroundColor: theme.error }]} />
              )}
              {stats.totalVistorias - stats.altoRisco > 0 && (
                <View style={[styles.riskSegment, { width: `${((stats.totalVistorias - stats.altoRisco) / stats.totalVistorias) * 100}%`, backgroundColor: theme.border }]} />
              )}
            </View>
            <View style={styles.riskLegend}>
              <View style={styles.riskLegendItem}>
                <View style={[styles.riskDot, { backgroundColor: theme.error }]} />
                <Text style={[styles.riskLegendText, { color: theme.textSecondary }]}>R3/R4 Alto ({stats.altoRisco})</Text>
              </View>
              <View style={styles.riskLegendItem}>
                <View style={[styles.riskDot, { backgroundColor: theme.border }]} />
                <Text style={[styles.riskLegendText, { color: theme.textSecondary }]}>R1/R2 Controlado ({stats.totalVistorias - stats.altoRisco})</Text>
              </View>
            </View>
            <Text style={[styles.riskTapHint, { color: theme.primary }]}>Toque para ver por município</Text>
          </TouchableOpacity>
        )}

        {/* Modal de Distribuição por Município */}
        <Modal
          visible={riskModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setRiskModalVisible(false)}
        >
          <View style={styles.riskModalOverlay}>
            <View style={[styles.riskModalContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.riskModalHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.riskModalTitle, { color: theme.text }]}>Risco por Município</Text>
                <TouchableOpacity onPress={() => setRiskModalVisible(false)}>
                  <Feather name="x" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              {riskLoading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 40 }} />
              ) : riskByCidade.length === 0 ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Feather name="bar-chart-2" size={36} color={theme.textSecondary} style={{ opacity: 0.4, marginBottom: 12 }} />
                  <Text style={{ color: theme.textSecondary, fontSize: 14, fontWeight: '600' }}>Sem dados de risco disponíveis.</Text>
                </View>
              ) : (
                <>
                  <View style={[styles.riskModalLegend, { borderBottomColor: theme.border }]}>
                    <View style={styles.riskLegendItem}>
                      <View style={[styles.riskDot, { backgroundColor: theme.error }]} />
                      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>R3/R4 Alto risco</Text>
                    </View>
                    <View style={styles.riskLegendItem}>
                      <View style={[styles.riskDot, { backgroundColor: theme.success }]} />
                      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>R1/R2 Controlado</Text>
                    </View>
                  </View>
                  <FlatList
                    data={riskByCidade}
                    keyExtractor={(item) => item.municipio}
                    contentContainerStyle={{ padding: 16 }}
                    renderItem={({ item, index }) => {
                      const total = item.alto + item.baixo;
                      const altoPercent = total > 0 ? (item.alto / total) * 100 : 0;
                      return (
                        <View style={[styles.riskCidadeRow, { borderBottomColor: theme.border }]}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                              <Text style={[styles.riskCidadeNome, { color: theme.text }]} numberOfLines={1}>
                                {index + 1}. {item.municipio || 'Não informado'}
                              </Text>
                              {item.alto > 0 && (
                                <View style={[styles.riskCidadeAlertBadge, { backgroundColor: theme.errorLight }]}>
                                  <Feather name="alert-triangle" size={10} color={theme.error} />
                                  <Text style={[styles.riskCidadeAlertText, { color: theme.error }]}>{item.alto} alto</Text>
                                </View>
                              )}
                            </View>
                            <View style={[styles.riskBarContainer, { marginBottom: 4 }]}>
                              {item.alto > 0 && (
                                <View style={[styles.riskSegment, { width: `${altoPercent}%`, backgroundColor: theme.error }]} />
                              )}
                              {item.baixo > 0 && (
                                <View style={[styles.riskSegment, { width: `${100 - altoPercent}%`, backgroundColor: theme.success }]} />
                              )}
                            </View>
                            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                              {item.baixo} R1/R2 • {item.alto} R3/R4 • {total} total
                            </Text>
                          </View>
                        </View>
                      );
                    }}
                  />
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Top municípios */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Top Municípios</Text>
        {municipios.map((m, i) => {
          const maxCount = municipios[0]?.count || 1;
          return (
            <View key={m.nome} style={[styles.munCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
              <Text style={[styles.munPos, { color: i < 3 ? theme.primary : theme.textSecondary }]}>#{i + 1}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.munRow}>
                  <Text style={[styles.munNome, { color: theme.text }]}>{m.nome}</Text>
                  <Text style={[styles.munCount, { color: theme.primary }]}>{m.count}</Text>
                </View>
                <View style={[styles.munBarBg, { backgroundColor: theme.iconBackground }]}>
                  <View style={[styles.munBarFill, { width: `${(m.count / maxCount) * 100}%`, backgroundColor: theme.primary }]} />
                </View>
              </View>
            </View>
          );
        })}

        {/* Ranking global de agentes */}
        {rankingGlobal.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 12 }]}>Top Agentes do Mês</Text>
            {rankingGlobal.map(({ nome, municipio, count }, i) => (
              <View key={nome} style={[styles.rankCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
                <Text style={[styles.rankPos, { color: i < 3 ? theme.primary : theme.textSecondary }]}>#{i + 1}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.rankName, { color: theme.text }]} numberOfLines={1}>{nome}</Text>
                  <Text style={[styles.rankMun, { color: theme.textSecondary }]}>{municipio}</Text>
                </View>
                <Text style={[styles.rankCount, { color: theme.primary }]}>{count}</Text>
              </View>
            ))}
          </>
        )}

        <DashboardGuide role="master_admin" inline />
        
        {/* Link para guia de protocolo */}
        <TouchableOpacity
          style={[styles.guiaBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
          onPress={() => router.push('/(panel)/admin/protocolo-doc')}
        >
          <View style={[styles.guiaBtnIcon, { backgroundColor: `${theme.primary}15` }]}>
            <Feather name="hash" size={18} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.guiaBtnTitle, { color: theme.text }]}>Guia de Protocolo</Text>
            <Text style={[styles.guiaBtnDesc, { color: theme.textSecondary }]}>Entenda os números dos laudos e vistorias</Text>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de confirmação de exclusão */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!deletando) { setDeleteTarget(null); setDeleteMotivo(''); } }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.deleteOverlay}>
            <View style={[styles.deleteSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {/* Ícone */}
              <View style={[styles.deleteIconWrap, { backgroundColor: theme.errorLight }]}>
                <Feather name="trash-2" size={28} color={theme.error} />
              </View>
              <Text style={[styles.deleteTitle, { color: theme.text }]}>Excluir Vistoria</Text>
              <Text style={[styles.deleteSubtitle, { color: theme.textSecondary }]}>
                Esta ação é irreversível. O agente, supervisor e administrador do município serão notificados.
              </Text>

              {/* Info da vistoria */}
              {deleteTarget && (
                <View style={[styles.deleteInfo, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
                  <Text style={[{ fontSize: 13, fontWeight: '700', color: theme.text }]} numberOfLines={2}>
                    {deleteTarget.endereco || 'Endereço não informado'}
                  </Text>
                  <Text style={[{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }]}>
                    {(deleteTarget as any).agenteNome || '—'} · {deleteTarget.municipio} · {['r3', 'r4', 'alto', 'critico', 'iminente'].includes(String(deleteTarget.nivelRisco || '').toLowerCase()) ? 'CRÍTICO' : deleteTarget.nivelRisco?.toUpperCase()}
                  </Text>
                </View>
              )}

              {/* Campo motivo */}
              <Text style={[styles.deleteLabel, { color: theme.textSecondary }]}>Motivo da exclusão *</Text>
              <TextInput
                style={[styles.deleteInput, {
                  backgroundColor: theme.iconBackground,
                  borderColor: deleteMotivo.trim() ? theme.primary : theme.border,
                  color: theme.text,
                }]}
                placeholder="Descreva o motivo (ex: duplicidade, erro de cadastro...)"
                placeholderTextColor={theme.textSecondary}
                value={deleteMotivo}
                onChangeText={setDeleteMotivo}
                multiline
                numberOfLines={3}
                maxLength={300}
                editable={!deletando}
              />
              <Text style={[{ fontSize: 11, color: theme.textSecondary, alignSelf: 'flex-end', marginTop: 4 }]}>
                {deleteMotivo.length}/300
              </Text>

              {/* Botões */}
              <View style={styles.deleteActions}>
                <TouchableOpacity
                  style={[styles.deleteCancelBtn, { borderColor: theme.border }]}
                  onPress={() => { setDeleteTarget(null); setDeleteMotivo(''); }}
                  disabled={deletando}
                >
                  <Text style={[{ fontSize: 15, fontWeight: '600', color: theme.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteConfirmBtn, { opacity: deleteMotivo.trim() ? 1 : 0.45 }]}
                  onPress={confirmarDelete}
                  disabled={!deleteMotivo.trim() || deletando}
                >
                  {deletando
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Confirmar exclusão</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  greeting: { fontSize: 22, fontWeight: '700', marginBottom: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 6, marginTop: 4 },
  chipBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1,
  },
  chipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: TCSPalette.danger, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  metricWide: { width: '100%', minHeight: 128 },
  metricHalf: { width: '48%', flexGrow: 1, minHeight: 112 },
  developerBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 18,
  },
  developerBannerIcon: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,58,237,0.18)',
  },
  developerBannerText: { fontSize: 12, lineHeight: 18, marginTop: 3, fontWeight: '500' },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 14, marginTop: 4,
  },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  kpiCard: {
    width: '47%', flexGrow: 1, borderRadius: 16, borderWidth: 1,
    padding: 16, alignItems: 'flex-start', justifyContent: 'space-between',
  },
  kpiIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  kpiValue: { fontSize: 26, fontWeight: '900' },
  kpiLabel: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  trainingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24,
  },
  trainingIcon: {
    width: 44, height: 44, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
  },
  trainingTitle: { fontSize: 15, fontWeight: '800' },
  trainingDesc: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  trainingDeadline: { fontSize: 11, marginTop: 4, fontWeight: '800' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  menuCard: {
    width: '47%', flexGrow: 1, borderRadius: 18, borderWidth: 1,
    padding: 18, alignItems: 'center', gap: 8,
  },
  menuIcon: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { fontSize: 14, fontWeight: '700' },
  menuDesc: { fontSize: 11, textAlign: 'center' },
  munCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    borderWidth: 1, padding: 14, marginBottom: 10,
  },
  munPos: { fontSize: 14, fontWeight: '900', width: 28 },
  munRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  munNome: { fontSize: 15, fontWeight: '700' },
  munCount: { fontSize: 15, fontWeight: '900' },
  munBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  munBarFill: { height: '100%', borderRadius: 3 },

  // Nova Seção: Risk Distribution
  riskDistributionCard: {
    borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 28,
  },
  riskCardTitle: { fontSize: 14, fontWeight: '800' },
  riskCardSubtitle: { fontSize: 13, fontWeight: '600' },
  riskBarContainer: {
    height: 8, flexDirection: 'row', borderRadius: 4, overflow: 'hidden',
    backgroundColor: '#333', marginBottom: 12, gap: 2,
  },
  riskSegment: { height: '100%' },
  riskLegend: { flexDirection: 'row', gap: 16 },
  riskLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  riskLegendText: { fontSize: 12, fontWeight: '600' },

  // Nova Seção: Logs Restritos
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },
  logCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    borderWidth: 1, padding: 14, marginBottom: 10,
  },
  logIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  logAcao: { fontSize: 13, fontWeight: '700' },
  logMeta: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1,
    padding: 14, marginBottom: 20,
  },
  alertTitle: { color: TCSPalette.danger, fontSize: 13, fontWeight: '800' },
  alertDesc: { color: TCSPalette.danger, fontSize: 12, opacity: 0.8, marginTop: 1 },
  rankCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8,
  },
  rankPos: { fontSize: 16, fontWeight: '800', width: 28 },
  rankName: { fontSize: 14, fontWeight: '700' },
  rankMun: { fontSize: 11, marginTop: 1 },
  rankCount: { fontSize: 18, fontWeight: '900' },
  guiaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 20,
  },
  guiaBtnIcon: { width: 40, height: 40, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  guiaBtnTitle: { fontSize: 14, fontWeight: '700' },
  guiaBtnDesc: { fontSize: 12, marginTop: 1 },
  riskTapHint: {
    fontSize: 11, fontWeight: '600', marginTop: 10, textAlign: 'right',
  },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 8,
  },
  deleteOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  deleteSheet: {
    width: '100%', borderRadius: 24, borderWidth: 1,
    padding: 24, alignItems: 'center',
  },
  deleteIconWrap: {
    width: 60, height: 60, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  deleteTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  deleteSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  deleteInfo: {
    width: '100%', borderRadius: 12, borderWidth: 1,
    padding: 12, marginBottom: 20,
  },
  deleteLabel: { fontSize: 12, fontWeight: '700', alignSelf: 'flex-start', marginBottom: 8, letterSpacing: 0.3 },
  deleteInput: {
    width: '100%', borderRadius: 12, borderWidth: 1.5,
    padding: 12, fontSize: 14, minHeight: 80,
    textAlignVertical: 'top',
  },
  deleteActions: {
    flexDirection: 'row', gap: 12, marginTop: 20, width: '100%',
  },
  deleteCancelBtn: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  deleteConfirmBtn: {
    flex: 2, height: 48, borderRadius: 14,
    backgroundColor: TCSPalette.danger,
    justifyContent: 'center', alignItems: 'center',
  },
  riskModalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  riskModalContainer: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, maxHeight: '80%',
  },
  riskModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  riskModalTitle: { fontSize: 18, fontWeight: '800' },
  riskModalLegend: {
    flexDirection: 'row', gap: 16, padding: 14, paddingBottom: 10,
    borderBottomWidth: 1,
  },
  riskCidadeRow: {
    paddingVertical: 12, borderBottomWidth: 1,
  },
  riskCidadeNome: { fontSize: 14, fontWeight: '700', flex: 1 },
  riskCidadeAlertBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 6,
  },
  riskCidadeAlertText: { fontSize: 10, fontWeight: '700' },
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: 12, marginTop: 12,
  },
  seeAll: { fontSize: 13, fontWeight: '700' },
  
  vistoriaCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    borderWidth: 1, padding: 16, marginBottom: 12,
  },
  riscoDot: {
    width: 48, height: 48, borderRadius: 14, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  vistoriaEnd: { fontSize: 15, fontWeight: '700' },
  vistoriaInfo: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  nivelBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  nivelText: { fontSize: 10, fontWeight: '900' },
});
