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
        .eq('usado', false)
        .order('criadoEm', { ascending: false });

      if (me.role !== 'master_admin') {
        query = query.eq('municipio', me.municipio);
      }

      const { data } = await query;
      setTokens(data || []);
      setErro(null);
    } catch (e: any) {
      logger.error('token', 'Erro ao carregar tokens', { erro: String(e) });
      setErro('Não foi possível carregar a lista de tokens. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Nota: setLoading(false) está no bloco finally — garante reset mesmo em early returns e erros

  useFocusEffect(useCallback(() => { loadTokens(); }, []));

  // Separar ativos dos expirados
  const ativos = tokens.filter(t => {
    if (!t.expiraEm) return true;
    return new Date(t.expiraEm).getTime() > Date.now();
  });
  const expirados = tokens.filter(t => {
    if (!t.expiraEm) return false;
    return new Date(t.expiraEm).getTime() <= Date.now();
  });

  const copiarToken = async (codigo: string) => {
    await Clipboard.setStringAsync(codigo);
    Alert.alert('Copiado!', 'Código de convite copiado para a área de transferência.');
  };

  const compartilharToken = async (token: any) => {
    const role = ROLE_LABELS[token.role] || token.role;
    const { texto } = getTempoRestante(token.expiraEm);
    await Share.share({
      message: `🔐 Convite Defesa Civil\n\nCódigo: ${token.codigo}\nPerfil: ${role}\nMunicípio: ${token.municipio}\nExpira em: ${texto}\n\nAcesse o app e use este código para criar sua conta.`,
      title: 'Token de Acesso — Defesa Civil',
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
            setCancelando(token.id);
            try {
              await supabase.from('invite_tokens').delete().eq('id', token.id);
              setTokens(prev => prev.filter(t => t.id !== token.id));
              logger.info('token', `Token cancelado manualmente: ${token.codigo}`);
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível cancelar o token.');
              logger.error('token', 'Erro ao cancelar token', { id: token.id, erro: String(e) });
            } finally {
              setCancelando(null);
            }
          }
        }
      ]
    );
  };

  const limparExpirados = () => {
    if (expirados.length === 0) return;
    Alert.alert(
      'Limpar expirados?',
      `${expirados.length} token${expirados.length > 1 ? 's' : ''} expirado${expirados.length > 1 ? 's' : ''} será${expirados.length > 1 ? 'ão' : ''} removido${expirados.length > 1 ? 's' : ''}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar', style: 'destructive', onPress: async () => {
            setLimpando(true);
            try {
              const ids = expirados.map(t => t.id);
              await supabase.from('invite_tokens').delete().in('id', ids);
              setTokens(prev => prev.filter(t => !ids.includes(t.id)));
              logger.info('token', `${ids.length} tokens expirados removidos`);
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível limpar os tokens.');
              logger.error('token', 'Erro ao limpar tokens expirados', { erro: String(e) });
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

  const renderToken = (t: any, isExpirado = false) => {
    const { texto: tempoTexto, cor: tempoCor } = getTempoRestante(t.expiraEm);
    const role = ROLE_LABELS[t.role] || t.role;
    return (
      <View
        style={[
          styles.tokenCard,
          { backgroundColor: theme.surfaceHighlight, borderColor: isExpirado ? 'rgba(239,68,68,0.25)' : theme.cardBorder },
          isExpirado && { opacity: 0.65 },
        ]}
      >
        {/* Código */}
        <View style={styles.tokenHeader}>
          <View style={[styles.keyIcon, { backgroundColor: isExpirado ? 'rgba(239,68,68,0.08)' : theme.iconBackground }]}>
            <Feather name="key" size={20} color={isExpirado ? '#EF4444' : theme.primary} />
          </View>
          <Text style={[styles.tokenCode, { color: isExpirado ? theme.textSecondary : theme.text }]}>
            {t.codigo}
          </Text>
          {!isExpirado && (
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
          <Badge 
            label={tempoTexto} 
            variant={isExpirado ? 'error' : (tempoCor === '#F59E0B' ? 'warning' : 'success')} 
            size="sm" 
          />
        </View>

        {!isExpirado && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.tokenActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => compartilharToken(t)}>
                <Feather name="share-2" size={16} color={theme.primary} />
                <Text style={[styles.actionText, { color: theme.primary }]}>Compartilhar</Text>
              </TouchableOpacity>
              {cancelando === t.id ? (
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
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
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
            title="Nenhum token ativo"
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
                {ativos.map((t, i) => <React.Fragment key={t.id ?? i}>{renderToken(t, false)}</React.Fragment>)}
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
                    onPress={limparExpirados}
                    disabled={limpando}
                  >
                    {limpando
                      ? <ActivityIndicator size="small" color="#EF4444" />
                      : (
                        <>
                          <Feather name="trash-2" size={13} color="#EF4444" />
                          <Text style={styles.limparBtnText}>Limpar todos</Text>
                        </>
                      )
                    }
                  </TouchableOpacity>
                </View>
                {expirados.map((t, i) => <React.Fragment key={t.id ?? i}>{renderToken(t, true)}</React.Fragment>)}
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
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 24,
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
  limparBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },
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
  emptyCard: {
    borderRadius: 20, borderWidth: 1, padding: 40, alignItems: 'center', marginTop: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
