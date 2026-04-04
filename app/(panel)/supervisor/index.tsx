import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { countAgendamentosPendentes } from '../../../utils/database';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { riscoColor } from '../../../utils/riscoUtils';
import { tempoRelativo } from '../../../utils/htmlUtils';
import { VistoriaNormalizada } from '../../../types/vistoria';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Atribuicao {
  id: string;
  endereco_completo: string;
  agente_nome: string;
  prioridade: string;
  status: string;
}

function prioridadeColor(p: string) {
  if (p === 'alta' || p === 'urgente') return '#EF4444';
  if (p === 'media') return '#F59E0B';
  return '#3B82F6';
}


export default function SupervisorDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vistorias, setVistorias] = useState<VistoriaNormalizada[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([]);
  const [agentesAtivos, setAgentesAtivos] = useState(0);
  const [pendingAgendamentos, setPendingAgendamentos] = useState(0);

  const carregar = async (showRefresh = false) => {
    if (!profile) return;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [vistoriasRes, agentesRes, atribuicoesRes] = await Promise.all([
        supabase
          .from('vistorias')
          .select('id, nivelRisco, pontuacaoTotal, endereco, municipio, dataVistoria, agenteNome, agenteUid, respostasJson, formularioId, status')
          .eq('municipio', profile.municipio)
          .order('dataVistoria', { ascending: false })
          .limit(20),
        supabase
          .from('users')
          .select('uid', { count: 'exact', head: true })
          .eq('municipio', profile.municipio)
          .eq('role', 'agent')
          .eq('isApproved', true),
        supabase
          .from('atribuicoes')
          .select('*')
          .eq('supervisor_uid', profile.uid)
          .eq('status', 'pendente'),
      ]);

      setVistorias(vistoriasRes.data || []);
      setAgentesAtivos(agentesRes.count || 0);
      setAtribuicoes(atribuicoesRes.data || []);
    } catch (e) {
      logger.error('system', 'Erro supervisor dashboard', { erro: String(e) });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    carregar();
    if (profile?.municipio) {
      setPendingAgendamentos(countAgendamentosPendentes(profile.municipio));
    }
  }, [profile?.municipio]));

  const totalVistorias = vistorias.length;
  const altoRisco = vistorias.filter(v =>
    v.nivelRisco === 'r3' || v.nivelRisco === 'r4'
  ).length;

  // Ranking de agentes (mês atual)
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const vistoriasMes = vistorias.filter(v => (v.dataVistoria ?? '') >= inicioMes);
  const contagem: Record<string, number> = {};
  vistoriasMes.forEach(v => {
    const nome = v.agenteNome || '?';
    contagem[nome] = (contagem[nome] || 0) + 1;
  });
  vistorias.forEach(v => {
    const nome = v.agenteNome || '?';
    if (!(nome in contagem)) contagem[nome] = 0;
  });
  const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const META_MENSAL = 10;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.text }]}>
            Olá, {profile?.name.split(' ')[0]}
          </Text>
          <Text style={[styles.role, { color: theme.textSecondary }]}>
            {profile?.municipio} · SUPERVISOR
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
            onPress={() => router.push('/(panel)/mapas')}
          >
            <Feather name="map" size={18} color={theme.primary} />
          </TouchableOpacity>
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
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        {/* Alerta alto risco */}
        {altoRisco > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => router.push('/(panel)/mapas')}
          >
            <Feather name="alert-triangle" size={20} color="#EF4444" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.alertTitle}>{altoRisco} ALERTA{altoRisco > 1 ? 'S' : ''} CRÍTICO{altoRisco > 1 ? 'S' : ''}</Text>
              <Text style={styles.alertDesc}>Vistorias de alto risco requerem atenção imediata.</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#EF4444" />
          </TouchableOpacity>
        )}

        {/* KPIs */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Visão Geral</Text>
        <View style={styles.kpiRow}>
          <TouchableOpacity 
            style={[styles.kpiBig, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
            onPress={() => router.push('/(panel)/inspecoes')}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingRight: 10 }}>
              <View style={[styles.kpiIcon, { backgroundColor: theme.iconBackground }]}>
                <Feather name="clipboard" size={24} color={theme.primary} />
              </View>
              <Feather name="arrow-up-right" size={18} color={theme.primary} style={{ opacity: 0.5, marginTop: 10 }} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.primary }]}>{totalVistorias}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Total Vistorias</Text>
          </TouchableOpacity>
          <View style={styles.kpiSmallCol}>
            <TouchableOpacity 
              style={[styles.kpiSmall, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              onPress={() => router.push('/(panel)/inspecoes')}
            >
              <Text style={[styles.kpiValueSm, { color: '#EF4444' }]}>{altoRisco}</Text>
              <Text style={[styles.kpiLabelSm, { color: theme.textSecondary }]}>Críticos</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.kpiSmall, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              onPress={() => router.push('/(panel)/supervisor/equipe')}
            >
              <Text style={[styles.kpiValueSm, { color: '#F59E0B' }]}>{agentesAtivos}</Text>
              <Text style={[styles.kpiLabelSm, { color: theme.textSecondary }]}>Agentes</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ranking da equipe */}
        {ranking.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Desempenho da Equipe</Text>
              <TouchableOpacity onPress={() => router.push('/(panel)/supervisor/equipe')}>
                <Text style={[styles.seeAll, { color: theme.primary }]}>Ver equipe</Text>
              </TouchableOpacity>
            </View>
            {ranking.map(([nome, count]) => {
              const progresso = Math.min(count / META_MENSAL, 1);
              const cor = count >= META_MENSAL ? '#10B981' : count >= META_MENSAL / 2 ? theme.primary : '#F59E0B';
              return (
                <View key={nome} style={[styles.rankCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
                  <View style={[styles.rankAvatar, { backgroundColor: theme.iconBackground }]}>
                    <Text style={[styles.rankAvatarText, { color: theme.primary }]}>
                      {nome[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.rankRow}>
                      <Text style={[styles.rankName, { color: theme.text }]} numberOfLines={1}>{nome}</Text>
                      <Text style={[styles.rankCount, { color: cor }]}>{count}/{META_MENSAL}</Text>
                    </View>
                    <View style={[styles.progressBg, { backgroundColor: theme.iconBackground }]}>
                      <View style={[styles.progressFill, { width: `${progresso * 100}%`, backgroundColor: cor }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Atribuições pendentes */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Atribuições Pendentes</Text>
          <TouchableOpacity onPress={() => router.push('/(panel)/supervisor/atribuicao')}>
            <Text style={[styles.seeAll, { color: theme.primary }]}>+ Nova</Text>
          </TouchableOpacity>
        </View>

        {atribuicoes.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nenhuma atribuição pendente.</Text>
          </View>
        ) : (
          atribuicoes.map(a => (
            <View key={a.id} style={[styles.atribuicaoCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.atribuicaoEndereco, { color: theme.text }]} numberOfLines={2}>
                  {a.endereco_completo || 'Endereço não informado'}
                </Text>
                <Text style={[styles.atribuicaoAgente, { color: theme.textSecondary }]}>
                  Para: {a.agente_nome || '—'}
                </Text>
              </View>
              <View style={[styles.prioridadeBadge, { backgroundColor: `${prioridadeColor(a.prioridade)}20` }]}>
                <Text style={[styles.prioridadeText, { color: prioridadeColor(a.prioridade) }]}>
                  {a.prioridade?.toUpperCase()}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Atividade recente */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Registro de Operações</Text>
        {vistorias.slice(0, 8).map(v => {
          const cor = riscoColor(v.nivelRisco);
          return (
            <TouchableOpacity
              key={v.id}
              style={[styles.vistoriaCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              onPress={() => router.push(`/(panel)/inspecoes/${v.id}`)}
            >
              <View style={[styles.riscoDot, { backgroundColor: `${cor}20`, borderColor: `${cor}40` }]}>
                <Feather
                  name={cor === '#EF4444' ? 'alert-triangle' : cor === '#F59E0B' ? 'alert-circle' : 'check-circle'}
                  size={20} color={cor}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.vistoriaEnd, { color: theme.text }]} numberOfLines={1}>
                  {v.endereco || 'Endereço não informado'}
                </Text>
                <Text style={[styles.vistoriaInfo, { color: theme.textSecondary }]}>
                  {v.agenteNome || '?'} · {tempoRelativo(v.dataVistoria)}
                </Text>
              </View>
              <View style={[styles.nivelBadge, { backgroundColor: `${cor}20` }]}>
                <Text style={[styles.nivelText, { color: cor }]}>
                  {v.nivelRisco?.toUpperCase() || '—'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FAB: Nova Atribuição */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/(panel)/supervisor/atribuicao')}
      >
        <Feather name="plus" size={24} color="#FFF" />
        <Text style={styles.fabText}>Nova Atribuição</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  greeting: { fontSize: 22, fontWeight: '700' },
  role: { fontSize: 12, fontWeight: '600', marginTop: 2, letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  scrollContent: { padding: 20, paddingBottom: 100 },

  alertBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    padding: 16, marginBottom: 24,
  },
  alertTitle: { color: '#EF4444', fontSize: 14, fontWeight: '900' },
  alertDesc: { color: '#EF4444', fontSize: 12, fontWeight: '600', opacity: 0.8 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  seeAll: { fontSize: 13, fontWeight: '600' },

  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  kpiBig: { flex: 2, borderRadius: 20, borderWidth: 1, padding: 20, justifyContent: 'center' },
  kpiIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  kpiValue: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  kpiLabel: { fontSize: 13, fontWeight: '700' },
  kpiSmallCol: { flex: 1, gap: 12 },
  kpiSmall: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
  kpiValueSm: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  kpiLabelSm: { fontSize: 11, fontWeight: '700', marginTop: 4 },

  rankCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    borderWidth: 1, padding: 16, marginBottom: 12,
  },
  rankAvatar: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  rankAvatarText: { fontSize: 16, fontWeight: '900' },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  rankName: { fontSize: 15, fontWeight: '700', flex: 1 },
  rankCount: { fontSize: 14, fontWeight: '900' },
  progressBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  atribuicaoCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    borderWidth: 1, padding: 16, marginBottom: 12,
  },
  atribuicaoEndereco: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  atribuicaoAgente: { fontSize: 13, fontWeight: '500' },
  prioridadeBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  prioridadeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

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

  emptyCard: {
    borderRadius: 16, borderWidth: 1, padding: 32, alignItems: 'center', marginBottom: 24,
  },
  emptyText: { fontSize: 14, fontWeight: '600' },

  fab: {
    position: 'absolute', bottom: 32, right: 24,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 16, borderRadius: 20,
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8,
  },
  fabText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
});
