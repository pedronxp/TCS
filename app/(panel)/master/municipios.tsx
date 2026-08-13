import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, TextInput, Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, EmptyState, FormField, MetricCard, Button } from '../../../components/ui';

/*
  SQL to create the RPC in Supabase:
  CREATE OR REPLACE FUNCTION get_municipios_stats()
  RETURNS TABLE (
    municipio TEXT,
    total_vistorias BIGINT,
    alto_risco BIGINT,
    total_agentes BIGINT
  ) AS $$
  BEGIN
    RETURN QUERY
    WITH VStats AS (
      SELECT v.municipio as mun, COUNT(*) as tv, SUM(CASE WHEN v."nivelRisco" IN ('r3', 'r4', 'alto') THEN 1 ELSE 0 END) as ar
      FROM vistorias v WHERE v.municipio IS NOT NULL GROUP BY v.municipio
    ),
    UStats AS (
      SELECT u.municipio as mun, COUNT(*) as ta FROM users u 
      WHERE u.role = 'agent' AND u."isApproved" = true AND u.municipio IS NOT NULL GROUP BY u.municipio
    ),
    AllMuns AS (SELECT mun FROM VStats UNION SELECT mun FROM UStats)
    SELECT m.mun as municipio, COALESCE(v.tv, 0) as total_vistorias, COALESCE(v.ar, 0) as alto_risco, COALESCE(u.ta, 0) as total_agentes
    FROM AllMuns m LEFT JOIN VStats v ON m.mun = v.mun LEFT JOIN UStats u ON m.mun = u.mun;
  END;
  $$ LANGUAGE plpgsql;
*/

interface MunicipioData {
  nome: string;
  totalVistorias: number;
  altoRisco: number;
  agentes: number;
  dominiosEmail: string[] | null;
}

export default function MunicipiosScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [municipios, setMunicipios] = useState<MunicipioData[]>([]);
  const [busca, setBusca] = useState('');
  const [expandedMun, setExpandedMun] = useState<string | null>(null);
  const [editandoDominio, setEditandoDominio] = useState<string | null>(null);
  const [novoDominio, setNovoDominio] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [criandoMunicipio, setCriandoMunicipio] = useState(false);
  const [novoMunNome, setNovoMunNome] = useState('');
  const [novoMunEstado, setNovoMunEstado] = useState('');
  const [novoMunUF, setNovoMunUF] = useState('');

  const carregar = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setErro(null);
    try {
      const [statsRes, municipiosRes] = await Promise.all([
        supabase.rpc('get_municipios_stats'),
        supabase.from('municipios').select('nome, dominios_email'),
      ]);

      if (statsRes.error) throw statsRes.error;
      if (municipiosRes.error) throw municipiosRes.error;

      const stats = statsRes.data || [];
      const munConfigs: Record<string, string[] | null> = {};
      (municipiosRes.data || []).forEach((m: any) => {
        munConfigs[m.nome] = m.dominios_email;
      });

      const mapa: Record<string, MunicipioData> = {};

      // Seed com todos os municípios cadastrados (mesmo sem atividade)
      Object.keys(munConfigs).forEach(nome => {
        mapa[nome] = { nome, totalVistorias: 0, altoRisco: 0, agentes: 0, dominiosEmail: munConfigs[nome] };
      });

      stats.forEach((s: any) => {
        if (!s.municipio) return;
        if (!mapa[s.municipio]) {
          mapa[s.municipio] = { 
            nome: s.municipio, 
            totalVistorias: 0, 
            altoRisco: 0, 
            agentes: 0, 
            dominiosEmail: munConfigs[s.municipio] ?? null 
          };
        }
        mapa[s.municipio].totalVistorias += Number(s.total_vistorias || 0);
        mapa[s.municipio].altoRisco += Number(s.alto_risco || 0);
        mapa[s.municipio].agentes += Number(s.total_agentes || 0);
      });

      setMunicipios(Object.values(mapa).sort((a, b) => b.totalVistorias - a.totalVistorias));
    } catch (e: any) {
      logger.error('system', 'Erro municípios', { erro: String(e) });
      setErro('Não foi possível carregar os dados dos municípios.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const adicionarDominio = async (mun: MunicipioData) => {
    const dom = novoDominio.trim().toLowerCase().replace(/^@/, '');
    if (!dom || !dom.includes('.')) {
      Alert.alert('Domínio inválido', 'Informe um domínio válido, ex: prefeitura.sp.gov.br');
      return;
    }
    setSalvando(true);
    try {
      const atual = mun.dominiosEmail || [];
      if (atual.includes(dom)) {
        Alert.alert('Duplicado', 'Este domínio já está na lista.');
        return;
      }
      const novos = [...atual, dom];
      const { error } = await supabase.rpc('set_municipio_email_domains', {
        p_nome: mun.nome,
        p_dominios: novos,
      });
      if (error) throw error;
      setMunicipios(prev => prev.map(m =>
        m.nome === mun.nome ? { ...m, dominiosEmail: novos } : m
      ));
      setNovoDominio('');
      setEditandoDominio(null);
    } catch (e: any) {
      const msg = e?.code === '42501'
        ? 'Permissão negada. Verifique se você tem perfil de master admin.'
        : e?.message || 'Não foi possível salvar o domínio.';
      Alert.alert('Erro', msg);
      logger.error('system', 'Erro salvar domínio', { erro: e?.message || JSON.stringify(e), code: e?.code });
    } finally {
      setSalvando(false);
    }
  };

  const criarMunicipio = async () => {
    const nome = novoMunNome.trim();
    const estado = novoMunEstado.trim();
    const uf = novoMunUF.trim().toUpperCase();
    if (!nome) {
      Alert.alert('Nome inválido', 'Digite o nome do município.');
      return;
    }
    if (!estado) {
      Alert.alert('Estado obrigatório', 'Digite o nome do estado (ex: São Paulo).');
      return;
    }
    if (!uf || uf.length !== 2) {
      Alert.alert('UF inválida', 'Digite a sigla do estado com 2 letras (ex: SP).');
      return;
    }
    if (municipios.some(m => m.nome.toLowerCase() === nome.toLowerCase())) {
      Alert.alert('Duplicado', 'Este município já está cadastrado.');
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.rpc('create_municipio', {
        p_nome: nome,
        p_estado: estado,
        p_uf: uf,
      });
      if (error) throw error;
      setMunicipios(prev => [...prev, { nome, totalVistorias: 0, altoRisco: 0, agentes: 0, dominiosEmail: null }]);
      setNovoMunNome('');
      setNovoMunEstado('');
      setNovoMunUF('');
      setCriandoMunicipio(false);
      Alert.alert('Município criado', `"${nome}" foi adicionado com sucesso.`);
    } catch (e: any) {
      const msg = e?.code === '42501'
        ? 'Permissão negada. Verifique se você tem perfil de master admin.'
        : e?.code === '23505'
        ? 'Este município já está cadastrado.'
        : 'Não foi possível criar o município. Tente novamente.';
      Alert.alert('Erro', msg);
      logger.error('system', 'Erro criar município', { erro: e?.message || JSON.stringify(e), code: e?.code });
    } finally {
      setSalvando(false);
    }
  };

  const removerDominio = async (mun: MunicipioData, dominio: string) => {
    Alert.alert('Remover domínio', `Remover @${dominio}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try {
          const novos = (mun.dominiosEmail || []).filter(d => d !== dominio);
          const { error } = await supabase.rpc('set_municipio_email_domains', {
            p_nome: mun.nome,
            p_dominios: novos,
          });
          if (error) throw error;
          setMunicipios(prev => prev.map(m =>
            m.nome === mun.nome ? { ...m, dominiosEmail: novos.length > 0 ? novos : null } : m
          ));
        } catch (e: any) {
          const msg = e?.code === '42501'
            ? 'Permissão negada. Verifique se você tem perfil de master admin.'
            : 'Não foi possível remover o domínio.';
          Alert.alert('Erro', msg);
        }
      }},
    ]);
  };

  const filtrados = municipios.filter(m =>
    !busca || m.nome.toLowerCase().includes(busca.toLowerCase())
  );
  const totalVistorias = municipios.reduce((sum, item) => sum + item.totalVistorias, 0);
  const totalAgentes = municipios.reduce((sum, item) => sum + item.agentes, 0);
  const totalAltoRisco = municipios.reduce((sum, item) => sum + item.altoRisco, 0);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
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
            onRetry={() => carregar(true)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Rede municipal"
          subtitle={`${municipios.length} municípios registrados`}
          onBack={() => router.back()}
          actionIcon={criandoMunicipio ? 'x' : 'plus'}
          actionLabel={criandoMunicipio ? 'Fechar criação' : 'Novo município'}
          onAction={() => setCriandoMunicipio(value => !value)}
        />
      </View>

      {/* Formulário inline para novo município */}
      {criandoMunicipio && (
        <View style={[styles.newMunForm, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Text style={[styles.newMunTitle, { color: theme.text }]}>Cadastrar município</Text>
          <Text style={[styles.newMunDescription, { color: theme.textSecondary }]}>Nome, estado e UF são obrigatórios para identificar o território.</Text>
          <FormField
              label="Município"
              required
              value={novoMunNome}
              onChangeText={setNovoMunNome}
              placeholder="Nome do município"
              autoCapitalize="words"
              autoFocus
            />
          <View style={styles.newMunRow}>
            <FormField
              label="Estado"
              required
              containerStyle={{ flex: 2 }}
              value={novoMunEstado}
              onChangeText={setNovoMunEstado}
              placeholder="Estado (ex: São Paulo)"
              autoCapitalize="words"
            />
            <FormField
              label="UF"
              required
              containerStyle={{ width: 86 }}
              value={novoMunUF}
              onChangeText={t => setNovoMunUF(t.toUpperCase())}
              placeholder="UF"
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
          <Button label="Cadastrar município" variant="primary" onPress={criarMunicipio} loading={salvando} disabled={salvando} fullWidth />
        </View>
      )}

      <View style={[styles.searchBar, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <View style={[styles.searchInput, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchText, { color: theme.text }]}
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar município..."
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
          <MetricCard value={municipios.length} label="Municípios" style={styles.metricCard} />
          <MetricCard value={totalVistorias} label="Vistorias" style={styles.metricCard} />
          <MetricCard value={totalAgentes} label="Agentes" tone="success" style={styles.metricCard} />
          <MetricCard value={totalAltoRisco} label="Alto risco" tone="danger" style={styles.metricCard} />
        </ScrollView>
        {filtrados.length === 0 ? (
          <EmptyState icon="map" title="Nenhum município" description="Ajuste a busca ou cadastre o primeiro território." />
        ) : (
          filtrados.map((m, i) => {
            const expanded = expandedMun === m.nome;
            return (
              <View key={m.nome} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                <TouchableOpacity onPress={() => setExpandedMun(expanded ? null : m.nome)}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.pos, { color: i < 3 ? theme.primary : theme.textSecondary }]}>#{i + 1}</Text>
                    <Text style={[styles.munNome, { color: theme.text }]}>{m.nome}</Text>
                    {m.altoRisco > 0 && (
                      <View style={[styles.alertBadge, { backgroundColor: theme.errorLight }]}>
                        <Feather name="alert-triangle" size={12} color={theme.error} />
                        <Text style={[styles.alertCount, { color: theme.error }]}>{m.altoRisco}</Text>
                      </View>
                    )}
                    <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} />
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.stat}>
                      <Feather name="clipboard" size={14} color={theme.primary} />
                      <Text style={[styles.statValue, { color: theme.text }]}>{m.totalVistorias}</Text>
                      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Vistorias</Text>
                    </View>
                    <View style={styles.stat}>
                      <Feather name="alert-triangle" size={14} color={theme.error} />
                      <Text style={[styles.statValue, { color: theme.text }]}>{m.altoRisco}</Text>
                      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Alto Risco</Text>
                    </View>
                    <View style={styles.stat}>
                      <Feather name="users" size={14} color={theme.success} />
                      <Text style={[styles.statValue, { color: theme.text }]}>{m.agentes}</Text>
                      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Agentes</Text>
                    </View>
                  </View>
                  {m.totalVistorias > 0 && (
                    <View style={styles.riskBarWrap}>
                      <View style={[styles.riskBarBg, { backgroundColor: `${theme.border}` }]}>
                        <View
                          style={[
                            styles.riskBarFill,
                            { backgroundColor: theme.error },
                            { width: `${Math.round((m.altoRisco / m.totalVistorias) * 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={[styles.riskBarLabel, { color: theme.textSecondary }]}>
                        {Math.round((m.altoRisco / m.totalVistorias) * 100)}% alto risco
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {expanded && (
                  <View style={[styles.expandSection, { borderTopColor: theme.border }]}>
                    <View style={styles.domainHeader}>
                      <Feather name="mail" size={14} color={theme.primary} />
                      <Text style={[styles.domainTitle, { color: theme.text }]}>Domínios de Email Autorizados</Text>
                      <TouchableOpacity onPress={() => setEditandoDominio(editandoDominio === m.nome ? null : m.nome)}>
                        <Feather name="plus" size={18} color={theme.primary} />
                      </TouchableOpacity>
                    </View>

                    {(!m.dominiosEmail || m.dominiosEmail.length === 0) && (
                      <Text style={[styles.domainEmpty, { color: theme.textSecondary }]}>
                        Sem restrição — qualquer email aceito
                      </Text>
                    )}

                    {(m.dominiosEmail || []).map(dom => (
                      <View key={dom} style={[styles.domainChip, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` }]}>
                        <Text style={[styles.domainText, { color: theme.primary }]}>@{dom}</Text>
                        <TouchableOpacity onPress={() => removerDominio(m, dom)}>
                          <Feather name="x" size={14} color={theme.error} />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {editandoDominio === m.nome && (
                      <View style={styles.domainInputRow}>
                        <TextInput
                          style={[styles.domainInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                          value={novoDominio}
                          onChangeText={setNovoDominio}
                          placeholder="prefeitura.sp.gov.br"
                          placeholderTextColor={theme.textSecondary}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                        <TouchableOpacity
                          style={[styles.domainAddBtn, { backgroundColor: salvando ? theme.textSecondary : theme.primary }]}
                          onPress={() => adicionarDominio(m)}
                          disabled={salvando}
                        >
                          {salvando
                            ? <ActivityIndicator size="small" color="#FFF" />
                            : <Feather name="check" size={18} color="#FFF" />
                          }
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  newMunForm: {
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, gap: 14,
  },
  newMunTitle: { fontSize: 18, fontWeight: '800' },
  newMunDescription: { fontSize: 13, lineHeight: 18, marginTop: -8 },
  newMunRow: { flexDirection: 'row', gap: 10 },
  searchBar: { padding: 14, borderBottomWidth: 1 },
  searchInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 44,
  },
  searchText: { flex: 1, fontSize: 15 },
  scrollContent: { padding: 20, paddingBottom: 100, gap: 12 },
  metricsRow: { gap: 10, paddingBottom: 4 },
  metricCard: { width: 112 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  pos: { fontSize: 13, fontWeight: '800', width: 28 },
  munNome: { flex: 1, fontSize: 16, fontWeight: '700' },
  alertBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  alertCount: { fontSize: 12, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 0 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600' },
  expandSection: { borderTopWidth: 1, marginTop: 14, paddingTop: 14, gap: 8 },
  domainHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  domainTitle: { flex: 1, fontSize: 13, fontWeight: '700' },
  domainEmpty: { fontSize: 12, fontStyle: 'italic', paddingVertical: 4 },
  domainChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
  },
  domainText: { fontSize: 13, fontWeight: '600' },
  domainInputRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  domainInput: {
    flex: 1, height: 44, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, fontSize: 14,
  },
  domainAddBtn: {
    width: 44, height: 44, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },
  riskBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  riskBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  riskBarFill: { height: 6, borderRadius: 3 },
  riskBarLabel: { fontSize: 11, fontWeight: '600', minWidth: 80, textAlign: 'right' },
});
