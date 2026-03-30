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

interface MunicipioData {
  nome: string;
  totalVistorias: number;
  altoRisco: number;
  agentes: number;
  dominiosEmail: string[] | null;
}

export default function MunicipiosScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [municipios, setMunicipios] = useState<MunicipioData[]>([]);
  const [busca, setBusca] = useState('');
  const [expandedMun, setExpandedMun] = useState<string | null>(null);
  const [editandoDominio, setEditandoDominio] = useState<string | null>(null);
  const [novoDominio, setNovoDominio] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [criandoMunicipio, setCriandoMunicipio] = useState(false);
  const [novoMunNome, setNovoMunNome] = useState('');

  const carregar = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [vistoriasRes, usuariosRes, municipiosRes] = await Promise.all([
        supabase.from('vistorias').select('municipio, nivelRisco'),
        supabase.from('users').select('municipio, role').eq('role', 'agent').eq('isApproved', true),
        supabase.from('municipios').select('nome, dominios_email'),
      ]);

      const vistorias = vistoriasRes.data || [];
      const usuarios = usuariosRes.data || [];
      const munConfigs: Record<string, string[] | null> = {};
      (municipiosRes.data || []).forEach((m: any) => {
        munConfigs[m.nome] = m.dominios_email;
      });

      const mapa: Record<string, MunicipioData> = {};

      // Seed com todos os municípios cadastrados (mesmo sem atividade)
      Object.keys(munConfigs).forEach(nome => {
        mapa[nome] = { nome, totalVistorias: 0, altoRisco: 0, agentes: 0, dominiosEmail: munConfigs[nome] };
      });

      vistorias.forEach((v: any) => {
        if (!v.municipio) return;
        if (!mapa[v.municipio]) mapa[v.municipio] = { nome: v.municipio, totalVistorias: 0, altoRisco: 0, agentes: 0, dominiosEmail: munConfigs[v.municipio] ?? null };
        mapa[v.municipio].totalVistorias++;
        if (v.nivelRisco === 'r3' || v.nivelRisco === 'r4' || v.nivelRisco === 'alto') {
          mapa[v.municipio].altoRisco++;
        }
      });

      usuarios.forEach((u: any) => {
        if (!u.municipio) return;
        if (!mapa[u.municipio]) mapa[u.municipio] = { nome: u.municipio, totalVistorias: 0, altoRisco: 0, agentes: 0, dominiosEmail: munConfigs[u.municipio] ?? null };
        mapa[u.municipio].agentes++;
      });

      setMunicipios(Object.values(mapa).sort((a, b) => b.totalVistorias - a.totalVistorias));
    } catch (e) {
      logger.error('system', 'Erro municípios', { erro: String(e) });
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
      await supabase.from('municipios').upsert({
        nome: mun.nome,
        dominios_email: novos,
      }, { onConflict: 'nome' });
      setMunicipios(prev => prev.map(m =>
        m.nome === mun.nome ? { ...m, dominiosEmail: novos } : m
      ));
      setNovoDominio('');
      setEditandoDominio(null);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar.');
      logger.error('system', 'Erro salvar domínio', { erro: String(e) });
    } finally {
      setSalvando(false);
    }
  };

  const criarMunicipio = async () => {
    const nome = novoMunNome.trim();
    if (!nome) {
      Alert.alert('Nome inválido', 'Digite o nome do município.');
      return;
    }
    if (municipios.some(m => m.nome.toLowerCase() === nome.toLowerCase())) {
      Alert.alert('Duplicado', 'Este município já está cadastrado.');
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.from('municipios').insert({ nome, dominios_email: null });
      if (error) throw error;
      setMunicipios(prev => [...prev, { nome, totalVistorias: 0, altoRisco: 0, agentes: 0, dominiosEmail: null }]);
      setNovoMunNome('');
      setCriandoMunicipio(false);
      Alert.alert('Município criado', `"${nome}" foi adicionado com sucesso.`);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível criar o município.');
      logger.error('system', 'Erro criar município', { erro: String(e) });
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
          await supabase.from('municipios').upsert({
            nome: mun.nome,
            dominios_email: novos.length > 0 ? novos : null,
          }, { onConflict: 'nome' });
          setMunicipios(prev => prev.map(m =>
            m.nome === mun.nome ? { ...m, dominiosEmail: novos.length > 0 ? novos : null } : m
          ));
        } catch (e) {
          Alert.alert('Erro', 'Não foi possível remover.');
        }
      }},
    ]);
  };

  const filtrados = municipios.filter(m =>
    !busca || m.nome.toLowerCase().includes(busca.toLowerCase())
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Municípios</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{municipios.length} registrados</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => setCriandoMunicipio(v => !v)}
        >
          <Feather name={criandoMunicipio ? 'x' : 'plus'} size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Formulário inline para novo município */}
      {criandoMunicipio && (
        <View style={[styles.newMunForm, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
          <Text style={[styles.newMunLabel, { color: theme.textSecondary }]}>NOVO MUNICÍPIO</Text>
          <View style={styles.newMunRow}>
            <TextInput
              style={[styles.newMunInput, { backgroundColor: theme.background, borderColor: theme.primary, color: theme.text }]}
              value={novoMunNome}
              onChangeText={setNovoMunNome}
              placeholder="Ex: São Paulo"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.newMunBtn, { backgroundColor: salvando ? theme.textSecondary : theme.primary }]}
              onPress={criarMunicipio}
              disabled={salvando}
            >
              {salvando
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Feather name="check" size={20} color="#FFF" />}
            </TouchableOpacity>
          </View>
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
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        {filtrados.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nenhum município encontrado.</Text>
          </View>
        ) : (
          filtrados.map((m, i) => {
            const expanded = expandedMun === m.nome;
            return (
              <View key={m.nome} style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
                <TouchableOpacity onPress={() => setExpandedMun(expanded ? null : m.nome)}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.pos, { color: i < 3 ? theme.primary : theme.textSecondary }]}>#{i + 1}</Text>
                    <Text style={[styles.munNome, { color: theme.text }]}>{m.nome}</Text>
                    {m.altoRisco > 0 && (
                      <View style={styles.alertBadge}>
                        <Feather name="alert-triangle" size={12} color="#EF4444" />
                        <Text style={styles.alertCount}>{m.altoRisco}</Text>
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
                      <Feather name="alert-triangle" size={14} color="#EF4444" />
                      <Text style={[styles.statValue, { color: theme.text }]}>{m.altoRisco}</Text>
                      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Alto Risco</Text>
                    </View>
                    <View style={styles.stat}>
                      <Feather name="users" size={14} color="#10B981" />
                      <Text style={[styles.statValue, { color: theme.text }]}>{m.agentes}</Text>
                      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Agentes</Text>
                    </View>
                  </View>
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
                          <Feather name="x" size={14} color="#EF4444" />
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
  header: {
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  addButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12,
  },
  newMunForm: {
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  newMunLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10,
  },
  newMunRow: { flexDirection: 'row', gap: 10 },
  newMunInput: {
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, fontSize: 15,
  },
  newMunBtn: {
    width: 48, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  searchBar: { padding: 14, borderBottomWidth: 1 },
  searchInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 44,
  },
  searchText: { flex: 1, fontSize: 15 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  pos: { fontSize: 13, fontWeight: '800', width: 28 },
  munNome: { flex: 1, fontSize: 16, fontWeight: '700' },
  alertBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(239,68,68,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  alertCount: { color: '#EF4444', fontSize: 12, fontWeight: '800' },
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
});
