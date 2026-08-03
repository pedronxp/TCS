import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Share
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AppHeader, Badge, ConfirmSheet, MetricCard, StateBanner } from '../../../components/ui';
import { formatarDataHora } from '../../../utils/htmlUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agente', supervisor: 'Supervisor', admin: 'Administrador',
};

function getTempoRestante(expiresAt: string | null) {
  if (!expiresAt) return { texto: 'Sem prazo', tone: 'success' as const, expirado: false };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { texto: 'Expirado', tone: 'error' as const, expirado: true };
  const horas = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const dias = Math.floor(horas / 24);
  let texto = '';
  if (dias > 0) texto = `${dias}d ${horas % 24}h`;
  else if (horas > 0) texto = `${horas}h ${mins}min`;
  else texto = `${mins}min`;
  const tone = diff < 2 * 3600000 ? 'error' as const : diff < 24 * 3600000 ? 'warning' as const : 'success' as const;
  return { texto, tone, expirado: false };
}

export default function TokensScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile } = useAuth();
  const isMasterAdmin = profile?.role === 'master_admin';
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<any[]>([]);
  const [adminLimites, setAdminLimites] = useState<Record<string, number>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [limpando, setLimpando] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{ lista: any[]; titulo: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tick, setTick] = useState(0);

  // Atualiza contagem de tempo a cada minuto
  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 60000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: me } = await supabase
        .from('users').select('municipio, role').eq('uid', session.user.id).single();
      if (!me) return;

      let query = supabase
        .from('invite_tokens')
        .select('*')
        .order('criadoEm', { ascending: false });

      if (me.role === 'master_admin') {
        // Master admin vê todos os tokens
      } else {
        // Admin comum vê SOMENTE os tokens que ELE GEROU + da SUA CIDADE
        query = query
          .eq('criadoPor', session.user.id)
          .eq('municipio', me.municipio);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        logger.error('token', 'Erro na query de tokens', { erro: queryError.message });
      }

      // Filtro de segurança client-side (caso RLS não filtre corretamente)
      const tokensSeguro = me.role === 'master_admin'
        ? (data || [])
        : (data || []).filter(t => t.criadoPor === session.user.id);

      setTokens(tokensSeguro);

      // Para master_admin: buscar limites de cada admin que gerou tokens
      if (me.role === 'master_admin') {
        const adminUids = [...new Set(tokensSeguro.map((t: any) => t.criadoPor).filter(Boolean))];
        if (adminUids.length > 0) {
          const { data: limiteData } = await supabase
            .from('users')
            .select('uid, token_limit')
            .in('uid', adminUids);
          if (limiteData) {
            const mapa: Record<string, number> = {};
            limiteData.forEach((u: any) => { mapa[u.uid] = u.token_limit ?? 20; });
            setAdminLimites(mapa);
          }
        }
      }
      setErro(null);
    } catch (e: any) {
      logger.error('token', 'Erro ao carregar tokens', { erro: String(e) });
      setErro('Não foi possível carregar a lista de tokens. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadTokens(); }, []));

  // Separar por status
  const ativos = tokens.filter(t => {
    if (t.usado) return false;
    if (!t.expiraEm) return true;
    return new Date(t.expiraEm).getTime() > Date.now();
  });
  const expirados = tokens.filter(t => {
    if (t.usado) return false;
    if (!t.expiraEm) return false;
    return new Date(t.expiraEm).getTime() <= Date.now();
  });
  const usados = tokens.filter(t => t.usado === true);

  // Para master_admin: agrupar por admin criador
  const tokensPorAdmin = React.useMemo(() => {
    if (tokens.length === 0) return {};
    const grupos: Record<string, { nome: string; municipio: string; ativos: number; usados: number; expirados: number; limite: number }> = {};
    tokens.forEach(t => {
      const key = t.criadoPor || 'unknown';
      if (!grupos[key]) {
        grupos[key] = {
          nome: t.criadoPorNome || 'Desconhecido',
          municipio: t.municipio || '',
          ativos: 0, usados: 0, expirados: 0,
          limite: adminLimites[key] ?? 20,
        };
      } else {
        // Atualizar limite caso já carregado
        grupos[key].limite = adminLimites[key] ?? grupos[key].limite;
      }
      const isUsado = t.usado === true;
      const isExpirado = !isUsado && t.expiraEm && new Date(t.expiraEm).getTime() <= Date.now();
      if (isUsado) grupos[key].usados++;
      else if (isExpirado) grupos[key].expirados++;
      else grupos[key].ativos++;
    });
    return grupos;
  }, [tokens, adminLimites]);

  const copiarToken = async (codigo: string) => {
    await Clipboard.setStringAsync(codigo);
    Alert.alert('Copiado!', 'Código de convite copiado para a área de transferência.');
  };

  const compartilharToken = async (token: any) => {
    const role = ROLE_LABELS[token.role] || token.role;
    const { texto } = getTempoRestante(token.expiraEm);
    await Share.share({
      message: `🔐 Convite TCS\n\nCódigo: ${token.codigo}\nPerfil: ${role}\nMunicípio: ${token.municipio}\nExpira em: ${texto}\n\nAcesse o app e use este código para criar sua conta.`,
      title: 'Token de Acesso — TCS',
    });
  };

  const cancelarToken = (token: any) => {
    setPendingRemoval({ lista: [token], titulo: 'Token ativo' });
  };

  const limparSecao = (lista: any[], titulo: string) => {
    if (lista.length === 0) return;
    setPendingRemoval({ lista, titulo });
  };

  const confirmarRemocao = async () => {
    const pending = pendingRemoval;
    if (!pending) return;
    setPendingRemoval(null);
    const codigos = pending.lista.map(t => t.codigo);
    const unica = codigos.length === 1;
    if (unica) setCancelando(codigos[0]); else setLimpando(true);
    try {
      await supabase.from('invite_tokens').delete().in('codigo', codigos);
      setTokens(prev => prev.filter(t => !codigos.includes(t.codigo)));
      logger.info('token', `${codigos.length} token(s) removido(s): ${pending.titulo}`);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível remover os tokens selecionados.');
      logger.error('token', 'Erro ao remover tokens', { erro: String(e) });
    } finally {
      setCancelando(null);
      setLimpando(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LoadingState />
      </View>
    );
  }

  if (erro) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <ErrorState
            title="Falha ao Carregar"
            message={erro}
            onRetry={loadTokens}
          />
        </View>
      </View>
    );
  }

  const renderToken = (t: any, variante: 'ativo' | 'expirado' | 'usado') => {
    const { texto: tempoTexto, tone: tempoTone } = getTempoRestante(t.expiraEm);
    const role = ROLE_LABELS[t.role] || t.role;
    const isExpirado = variante === 'expirado';
    const isUsado = variante === 'usado';
    const dimmed = isExpirado || isUsado;

    return (
      <View
        key={t.codigo}
        style={[
          styles.tokenCard,
          { backgroundColor: theme.surface, borderColor: isUsado ? theme.successLight : isExpirado ? theme.errorLight : theme.cardBorder },
          dimmed && { opacity: 0.65 },
        ]}
      >
        {/* Código */}
        <View style={styles.tokenHeader}>
          <View style={[styles.keyIcon, {
            backgroundColor: isUsado
              ? theme.successLight
              : isExpirado ? theme.errorLight : theme.iconBackground
          }]}>
            <Feather
              name={isUsado ? 'check-circle' : 'key'}
              size={20}
              color={isUsado ? theme.success : isExpirado ? theme.error : theme.primary}
            />
          </View>
          <Text style={[styles.tokenCode, { color: dimmed ? theme.textSecondary : theme.text }]}>
            {t.codigo}
          </Text>
          {variante === 'ativo' && (
            <TouchableOpacity onPress={() => copiarToken(t.codigo)}>
              <Feather name="copy" size={18} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* Info */}
        <View style={styles.tokenInfo}>
          <Badge label={role} variant={t.role} size="sm" />
          <View style={styles.infoItem}>
            <Feather name="map-pin" size={14} color={theme.textSecondary} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>{t.municipio}</Text>
          </View>
          {isUsado ? (
            <Badge label="Utilizado" variant="success" size="sm" />
          ) : (
            <Badge
              label={tempoTexto}
              variant={tempoTone}
              size="sm"
            />
          )}
        </View>

        {/* Info de quem usou o token */}
        {isUsado && (t.usadoPorNome || t.usadoPorIp || t.usadoEm) && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.usedBySection}>
              <View style={[styles.usedByIcon, { backgroundColor: theme.successLight }]}>
                <Feather name="user-check" size={16} color={theme.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.usedByTitle, { color: theme.text }]}>
                  {t.usadoPorNome || 'Usuário desconhecido'}
                </Text>
                <View style={styles.usedByDetails}>
                  {t.usadoEm && (
                    <Text style={[styles.usedByDetail, { color: theme.textSecondary }]}>
                      <Feather name="calendar" size={11} color={theme.textSecondary} />{' '}
                      {formatarDataHora(t.usadoEm)}
                    </Text>
                  )}
                  {t.usadoPorIp && (
                    <Text style={[styles.usedByDetail, { color: theme.textSecondary }]}>
                      <Feather name="wifi" size={11} color={theme.textSecondary} />{' '}
                      {t.usadoPorIp}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </>
        )}

        {/* Ações */}
        {variante === 'ativo' && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.tokenActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => compartilharToken(t)}>
                <Feather name="share-2" size={16} color={theme.primary} />
                <Text style={[styles.actionText, { color: theme.primary }]}>Compartilhar</Text>
              </TouchableOpacity>
              {cancelando === t.codigo ? (
                <ActivityIndicator size="small" color={theme.error} />
              ) : (
                <TouchableOpacity style={styles.actionBtn} onPress={() => cancelarToken(t)}>
                  <Feather name="trash-2" size={16} color={theme.error} />
                  <Text style={[styles.actionText, { color: theme.error }]}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Convites de acesso"
          subtitle={`${tokens.length} ${tokens.length === 1 ? 'convite emitido' : 'convites emitidos'}`}
          onBack={() => router.back()}
          actionIcon="plus"
          actionLabel="Gerar convite"
          onAction={() => router.push('/(panel)/admin/gerar-token')}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}>
        <View style={styles.metricsRow}>
          <MetricCard value={ativos.length} label="Ativos" tone="primary" style={styles.metric} />
          <MetricCard value={usados.length} label="Utilizados" tone="success" style={styles.metric} />
          <MetricCard value={expirados.length} label="Expirados" tone="danger" style={styles.metric} />
        </View>
        <StateBanner
          title="Convites são pessoais e de uso único"
          description="Confirme perfil, município e validade antes de compartilhar o código."
          variant="info"
        />
        {/* Resumo por admin — apenas para master_admin */}
        {isMasterAdmin && Object.keys(tokensPorAdmin).length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginBottom: 10 }]}>
              POR ADMINISTRADOR
            </Text>
            {Object.entries(tokensPorAdmin).map(([uid, stats]) => {
              const totalGerado = stats.ativos + stats.usados + stats.expirados;
              const pct = stats.limite > 0 ? Math.min(totalGerado / stats.limite, 1) : 0;
              const corBarra = pct >= 1 ? theme.error : pct >= 0.8 ? theme.warning : theme.success;
              return (
                <View
                  key={uid}
                  style={[styles.adminSummaryCard, {
                    backgroundColor: theme.surfaceHighlight,
                    borderColor: pct >= 1 ? theme.errorLight : theme.cardBorder,
                  }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <View style={[styles.adminSummaryIcon, { backgroundColor: `${theme.primary}15` }]}>
                      <Feather name="shield" size={16} color={theme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.adminSummaryNome, { color: theme.text }]} numberOfLines={1}>
                        {stats.nome}
                      </Text>
                      <Text style={[styles.adminSummaryMun, { color: theme.textSecondary }]}>
                        {stats.municipio}
                      </Text>
                    </View>
                    {/* Quota numérica */}
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.adminQuotaNum, { color: pct >= 1 ? theme.error : theme.text }]}>
                        {totalGerado}/{stats.limite}
                      </Text>
                      <Text style={[styles.adminQuotaLabel, { color: theme.textSecondary }]}>este mês</Text>
                    </View>
                  </View>

                  {/* Barra de progresso */}
                  <View style={[styles.adminProgressBg, { backgroundColor: theme.iconBackground }]}>
                    <View style={[styles.adminProgressFill, {
                      width: `${pct * 100}%`,
                      backgroundColor: corBarra,
                    }]} />
                  </View>

                  {/* Badges contagem */}
                  <View style={[styles.adminSummaryStats, { marginTop: 10 }]}>
                    {stats.ativos > 0 && (
                      <View style={[styles.adminStat, { backgroundColor: `${theme.primary}15` }]}>
                        <Text style={[styles.adminStatNum, { color: theme.primary }]}>{stats.ativos}</Text>
                        <Text style={[styles.adminStatLabel, { color: theme.primary }]}>ativos</Text>
                      </View>
                    )}
                    {stats.usados > 0 && (
                      <View style={[styles.adminStat, { backgroundColor: theme.successLight }]}>
                        <Text style={[styles.adminStatNum, { color: theme.success }]}>{stats.usados}</Text>
                        <Text style={[styles.adminStatLabel, { color: theme.success }]}>usados</Text>
                      </View>
                    )}
                    {stats.expirados > 0 && (
                      <View style={[styles.adminStat, { backgroundColor: theme.errorLight }]}>
                        <Text style={[styles.adminStatNum, { color: theme.error }]}>{stats.expirados}</Text>
                        <Text style={[styles.adminStatLabel, { color: theme.error }]}>expirados</Text>
                      </View>
                    )}
                    {pct >= 1 && (
                      <View style={[styles.adminStat, { backgroundColor: theme.errorLight, marginLeft: 'auto' }]}>
                        <Feather name="alert-circle" size={11} color={theme.error} />
                        <Text style={[styles.adminStatLabel, { color: theme.error }]}>limite atingido</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: 16 }]} />
          </>
        )}

        {tokens.length === 0 ? (
          <EmptyState
            icon="key"
            title="Nenhum token"
            description="Gere um token de convite para permitir que novos usuários criem conta."
            actionLabel="Gerar Token"
            onAction={() => router.push('/(panel)/admin/gerar-token')}
          />
        ) : (
          <>
            {/* Tokens ativos */}
            {ativos.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  ATIVOS — {ativos.length}
                </Text>
                {ativos.map(t => renderToken(t, 'ativo'))}
              </>
            )}

            {/* Tokens expirados */}
            {expirados.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionLabel, { color: theme.error }]}>
                    EXPIRADOS — {expirados.length}
                  </Text>
                  <TouchableOpacity
                    style={styles.limparBtn}
                    onPress={() => limparSecao(expirados, 'Expirados')}
                    disabled={limpando}
                  >
                    {limpando
                      ? <ActivityIndicator size="small" color={theme.error} />
                      : (
                        <>
                          <Feather name="trash-2" size={13} color={theme.error} />
                          <Text style={[styles.limparBtnText, { color: theme.error }]}>Limpar todos</Text>
                        </>
                      )
                    }
                  </TouchableOpacity>
                </View>
                {expirados.map(t => renderToken(t, 'expirado'))}
              </>
            )}

            {/* Tokens utilizados */}
            {usados.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionLabel, { color: theme.success }]}>
                    UTILIZADOS — {usados.length}
                  </Text>
                  <TouchableOpacity
                    style={styles.limparBtn}
                    onPress={() => limparSecao(usados, 'Utilizados')}
                    disabled={limpando}
                  >
                    {limpando
                      ? <ActivityIndicator size="small" color={theme.success} />
                      : (
                        <>
                          <Feather name="trash-2" size={13} color={theme.success} />
                          <Text style={[styles.limparBtnText, { color: theme.success }]}>Limpar todos</Text>
                        </>
                      )
                    }
                  </TouchableOpacity>
                </View>
                {usados.map(t => renderToken(t, 'usado'))}
              </>
            )}
          </>
        )}
      </ScrollView>
      <ConfirmSheet
        visible={Boolean(pendingRemoval)}
        title={pendingRemoval?.lista.length === 1 ? 'Cancelar convite?' : `Limpar ${pendingRemoval?.titulo.toLowerCase()}?`}
        description={pendingRemoval?.lista.length === 1
          ? `O código ${pendingRemoval?.lista[0]?.codigo} será invalidado e não poderá mais ser usado.`
          : `${pendingRemoval?.lista.length ?? 0} convites serão removidos permanentemente.`}
        onDismiss={() => setPendingRemoval(null)}
        actions={[
          { label: pendingRemoval?.lista.length === 1 ? 'Cancelar convite' : 'Remover convites', variant: 'danger', onPress: confirmarRemocao },
          { label: 'Manter', variant: 'ghost', onPress: () => setPendingRemoval(null) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60, gap: 18 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minWidth: 0 },
  adminSummaryCard: {
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  adminSummaryIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  adminSummaryNome: { fontSize: 14, fontWeight: '700' },
  adminSummaryMun: { fontSize: 11, marginTop: 1 },
  adminSummaryStats: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  adminStat: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  adminStatNum: { fontSize: 13, fontWeight: '800' },
  adminStatLabel: { fontSize: 10, fontWeight: '600' },
  adminQuotaNum: { fontSize: 15, fontWeight: '900', letterSpacing: -0.3 },
  adminQuotaLabel: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  adminProgressBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
  adminProgressFill: { height: 5, borderRadius: 3 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 12, marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, marginTop: 20,
  },
  limparBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  limparBtnText: { fontSize: 13, fontWeight: '700' },
  tokenCard: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 14 },
  tokenHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  keyIcon: {
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  tokenCode: { flex: 1, fontSize: 20, fontWeight: '900', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  divider: { height: 1, marginVertical: 14 },
  tokenInfo: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, fontWeight: '500' },
  tokenActions: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  actionText: { fontSize: 14, fontWeight: '700' },

  // ── Seção "Cadastrado por" ──
  usedBySection: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  usedByIcon: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  usedByTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  usedByDetails: { flexDirection: 'column', gap: 2 },
  usedByDetail: { fontSize: 12, fontWeight: '500' },
});
