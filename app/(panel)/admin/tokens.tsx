import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Share
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/ui/Badge';
import { formatarDataHora } from '../../../utils/htmlUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agente', supervisor: 'Supervisor', admin: 'Administrador',
};

function getTempoRestante(expiresAt: string | null) {
  if (!expiresAt) return { texto: 'Sem prazo', cor: '#10B981', expirado: false };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { texto: 'Expirado', cor: '#EF4444', expirado: true };
  const horas = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const dias = Math.floor(horas / 24);
  let texto = '';
  if (dias > 0) texto = `${dias}d ${horas % 24}h`;
  else if (horas > 0) texto = `${horas}h ${mins}min`;
  else texto = `${mins}min`;
  const cor = diff < 2 * 3600000 ? '#EF4444' : diff < 24 * 3600000 ? '#F59E0B' : '#10B981';
  return { texto, cor, expirado: false };
}

export default function TokensScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<any[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [limpando, setLimpando] = useState(false);
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
    Alert.alert(
      'Cancelar token?',
      `O código "${token.codigo}" será invalidado e não poderá mais ser usado.`,
      [
        { text: 'Manter', style: 'cancel' },
        {
          text: 'Cancelar Token', style: 'destructive', onPress: async () => {
            setCancelando(token.codigo);
            try {
              await supabase.from('invite_tokens').delete().eq('codigo', token.codigo);
              setTokens(prev => prev.filter(t => t.codigo !== token.codigo));
              logger.info('token', `Token cancelado manualmente: ${token.codigo}`);
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível cancelar o token.');
              logger.error('token', 'Erro ao cancelar token', { codigo: token.codigo, erro: String(e) });
            } finally {
              setCancelando(null);
            }
          }
        }
      ]
    );
  };

  const limparSecao = (lista: any[], titulo: string) => {
    if (lista.length === 0) return;
    Alert.alert(
      `Limpar ${titulo.toLowerCase()}?`,
      `${lista.length} token${lista.length > 1 ? 's' : ''} ${titulo.toLowerCase()} será${lista.length > 1 ? 'ão' : ''} removido${lista.length > 1 ? 's' : ''}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar', style: 'destructive', onPress: async () => {
            setLimpando(true);
            try {
              const codigos = lista.map(t => t.codigo);
              await supabase.from('invite_tokens').delete().in('codigo', codigos);
              setTokens(prev => prev.filter(t => !codigos.includes(t.codigo)));
              logger.info('token', `${codigos.length} tokens ${titulo.toLowerCase()} removidos`);
            } catch (e) {
              Alert.alert('Erro', `Não foi possível limpar os tokens ${titulo.toLowerCase()}.`);
              logger.error('token', `Erro ao limpar tokens ${titulo.toLowerCase()}`, { erro: String(e) });
            } finally {
              setLimpando(false);
            }
          }
        }
      ]
    );
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
    const { texto: tempoTexto, cor: tempoCor } = getTempoRestante(t.expiraEm);
    const role = ROLE_LABELS[t.role] || t.role;
    const isExpirado = variante === 'expirado';
    const isUsado = variante === 'usado';
    const dimmed = isExpirado || isUsado;

    return (
      <View
        key={t.codigo}
        style={[
          styles.tokenCard,
          { backgroundColor: theme.surfaceHighlight, borderColor: isUsado ? 'rgba(16,185,129,0.25)' : isExpirado ? 'rgba(239,68,68,0.25)' : theme.cardBorder },
          dimmed && { opacity: 0.65 },
        ]}
      >
        {/* Código */}
        <View style={styles.tokenHeader}>
          <View style={[styles.keyIcon, {
            backgroundColor: isUsado
              ? 'rgba(16,185,129,0.08)'
              : isExpirado ? 'rgba(239,68,68,0.08)' : theme.iconBackground
          }]}>
            <Feather
              name={isUsado ? 'check-circle' : 'key'}
              size={20}
              color={isUsado ? '#10B981' : isExpirado ? '#EF4444' : theme.primary}
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
              variant={isExpirado ? 'error' : (tempoCor === '#F59E0B' ? 'warning' : 'success')}
              size="sm"
            />
          )}
        </View>

        {/* Info de quem usou o token */}
        {isUsado && (t.usadoPorNome || t.usadoPorIp || t.usadoEm) && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.usedBySection}>
              <View style={[styles.usedByIcon, { backgroundColor: 'rgba(16,185,129,0.08)' }]}>
                <Feather name="user-check" size={16} color="#10B981" />
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
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <TouchableOpacity style={styles.actionBtn} onPress={() => cancelarToken(t)}>
                  <Feather name="trash-2" size={16} color="#EF4444" />
                  <Text style={[styles.actionText, { color: '#EF4444' }]}>Cancelar</Text>
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Tokens de Acesso</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {ativos.length} ativo{ativos.length !== 1 ? 's' : ''}
            {expirados.length > 0 ? ` · ${expirados.length} expirado${expirados.length !== 1 ? 's' : ''}` : ''}
            {usados.length > 0 ? ` · ${usados.length} utilizado${usados.length !== 1 ? 's' : ''}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/(panel)/admin/gerar-token')}
        >
          <Feather name="plus" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                  <Text style={[styles.sectionLabel, { color: '#EF4444' }]}>
                    EXPIRADOS — {expirados.length}
                  </Text>
                  <TouchableOpacity
                    style={styles.limparBtn}
                    onPress={() => limparSecao(expirados, 'Expirados')}
                    disabled={limpando}
                  >
                    {limpando
                      ? <ActivityIndicator size="small" color="#EF4444" />
                      : (
                        <>
                          <Feather name="trash-2" size={13} color="#EF4444" />
                          <Text style={[styles.limparBtnText, { color: '#EF4444' }]}>Limpar todos</Text>
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
                  <Text style={[styles.sectionLabel, { color: '#10B981' }]}>
                    UTILIZADOS — {usados.length}
                  </Text>
                  <TouchableOpacity
                    style={styles.limparBtn}
                    onPress={() => limparSecao(usados, 'Utilizados')}
                    disabled={limpando}
                  >
                    {limpando
                      ? <ActivityIndicator size="small" color="#10B981" />
                      : (
                        <>
                          <Feather name="trash-2" size={13} color="#10B981" />
                          <Text style={[styles.limparBtnText, { color: '#10B981' }]}>Limpar todos</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  addBtn: {
    width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  scrollContent: { padding: 20, paddingBottom: 60 },
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
