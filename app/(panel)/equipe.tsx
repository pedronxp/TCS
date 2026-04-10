import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Modal, FlatList, Pressable
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../utils/supabase';
import { logger } from '../../utils/logger';
import { tempoRelativo } from '../../utils/htmlUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../utils/useBottomTabPadding';

interface AgenteCard {
  uid: string;
  name: string;
  email: string;
  municipio: string | null;
  supervisor: string | null;
  total: number;
  alto: number;
  medio: number;
  baixo: number;
  ultima: string | null;
}

type FiltroRisco = 'todos' | 'alto' | 'medio' | 'baixo';

interface DropdownOption { label: string; value: string; color?: string }

interface DropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onSelect: (v: string) => void;
  icon?: React.ComponentProps<typeof Feather>['name'];
  accentColor?: string;
}

function Dropdown({ label, value, options, onSelect, icon, accentColor }: DropdownProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = options.find(o => o.value === value);
  const isActive = value !== 'todos';

  return (
    <>
      <TouchableOpacity
        style={[
          styles.dropdownBtn,
          {
            backgroundColor: isActive
              ? `${accentColor || theme.primary}18`
              : theme.iconBackground,
            borderColor: isActive
              ? `${accentColor || theme.primary}40`
              : theme.border,
          },
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        {icon && (
          <Feather
            name={icon}
            size={13}
            color={isActive ? (accentColor || theme.primary) : theme.textSecondary}
          />
        )}
        <Text
          style={[
            styles.dropdownBtnText,
            { color: isActive ? (accentColor || theme.primary) : theme.textSecondary },
          ]}
          numberOfLines={1}
        >
          {selected?.label || label}
        </Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={13}
          color={isActive ? (accentColor || theme.primary) : theme.textSecondary}
        />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={[styles.modalSheet, {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            paddingBottom: insets.bottom + 8,
          }]}>
            {/* Handle */}
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />

            <Text style={[styles.modalTitle, { color: theme.text }]}>{label}</Text>

            <FlatList
              data={options}
              keyExtractor={o => o.value}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const sel = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalOption,
                      sel && { backgroundColor: `${accentColor || theme.primary}12` },
                    ]}
                    onPress={() => { onSelect(item.value); setOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.modalOptionDot,
                      { backgroundColor: sel ? (item.color || accentColor || theme.primary) : 'transparent', borderColor: item.color || accentColor || theme.border },
                    ]} />
                    <Text style={[
                      styles.modalOptionText,
                      { color: sel ? (item.color || accentColor || theme.primary) : theme.text, fontWeight: sel ? '700' : '500' },
                    ]}>
                      {item.label}
                    </Text>
                    {sel && (
                      <Feather name="check" size={16} color={item.color || accentColor || theme.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default function EquipeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const [loading, setLoading] = useState(true);
  const [agentes, setAgentes] = useState<AgenteCard[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroRisco, setFiltroRisco] = useState<FiltroRisco>('todos');
  const [isMaster, setIsMaster] = useState(false);

  // Filtros Master Admin
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [supervisores, setSupervisores] = useState<{ uid: string; name: string; municipio: string | null }[]>([]);
  const [filtroMunicipio, setFiltroMunicipio] = useState<string>('todos');
  const [filtroSupervisor, setFiltroSupervisor] = useState<string>('todos');
  // supervisorUid → agente UIDs vinculados via atribuicoes (vínculo real)
  const [atribuicoesMap, setAtribuicoesMap] = useState<Record<string, string[]>>({});

  useEffect(() => { loadEquipe(); }, []);

  const loadEquipe = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: user } = await supabase
        .from('users').select('municipio, role').eq('uid', session.user.id).single();

      const master = user?.role === 'master_admin';
      if (master) setIsMaster(true);

      let supQuery = supabase
        .from('users')
        .select('uid, name, municipio')
        .eq('role', 'supervisor')
        .eq('isApproved', true);
      if (!master && user?.municipio) {
        supQuery = supQuery.eq('municipio', user.municipio);
      }
      const { data: supervisorsList } = await supQuery;

      if (master && supervisorsList) setSupervisores(supervisorsList as any[]);

      let query = supabase
        .from('users')
        .select('uid, name, email, municipio')
        .eq('role', 'agent')
        .eq('isApproved', true);

      if (!master) {
        if (!user?.municipio) return;
        query = query.eq('municipio', user.municipio);
      }

      const { data: agentesList } = await query;
      if (!agentesList) return;

      // Buscar vínculos reais supervisor→agente via tabela atribuicoes
      const agenteUids = agentesList.map((a: any) => a.uid);
      const { data: atribuicoesList } = await supabase
        .from('atribuicoes')
        .select('supervisor_uid, agente_uid')
        .in('agente_uid', agenteUids);

      const supAgenteMap: Record<string, string[]> = {};
      const agenteSupervNomes: Record<string, string[]> = {};
      if (atribuicoesList) {
        const supNomeMap: Record<string, string> = {};
        if (supervisorsList) {
          supervisorsList.forEach((s: any) => { supNomeMap[s.uid] = s.name; });
        }
        atribuicoesList.forEach((row: any) => {
          if (!supAgenteMap[row.supervisor_uid]) supAgenteMap[row.supervisor_uid] = [];
          supAgenteMap[row.supervisor_uid].push(row.agente_uid);
          if (!agenteSupervNomes[row.agente_uid]) agenteSupervNomes[row.agente_uid] = [];
          const nome = supNomeMap[row.supervisor_uid];
          if (nome) agenteSupervNomes[row.agente_uid].push(nome);
        });
      }
      setAtribuicoesMap(supAgenteMap);

      if (master) {
        const municsSet = new Set<string>();
        agentesList.forEach((a: any) => { if (a.municipio) municsSet.add(a.municipio); });
        setMunicipios(Array.from(municsSet).sort());
      }

      const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const cards: AgenteCard[] = await Promise.all(
        agentesList.map(async (agente: any) => {
          const { data: vistorias } = await supabase
            .from('vistorias')
            .select('nivelRisco, dataVistoria')
            .eq('agenteUid', agente.uid)
            .gte('dataVistoria', trintaDiasAtras)
            .order('dataVistoria', { ascending: false });

          const lista = vistorias || [];
          const alto = lista.filter((v: any) => v.nivelRisco === 'r3' || v.nivelRisco === 'r4' || v.nivelRisco === 'alto').length;
          const medio = lista.filter((v: any) => v.nivelRisco === 'r2' || v.nivelRisco === 'medio').length;
          const baixo = lista.filter((v: any) => v.nivelRisco === 'r1' || v.nivelRisco === 'baixo').length;
          const supNames = agenteSupervNomes[agente.uid] || [];

          return {
            uid: agente.uid,
            name: agente.name || '—',
            email: agente.email || '—',
            municipio: agente.municipio || null,
            supervisor: supNames.length > 0 ? supNames.join(', ') : null,
            total: lista.length,
            alto, medio, baixo,
            ultima: lista[0]?.dataVistoria || null,
          };
        })
      );

      setAgentes(cards.sort((a, b) => b.total - a.total));
    } catch (e) {
      logger.error('system', 'Erro ao carregar equipe', { erro: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const supervisoresFiltrados = filtroMunicipio === 'todos'
    ? supervisores
    : supervisores.filter(s => s.municipio === filtroMunicipio);

  const filtrados = agentes.filter(a => {
    const q = busca.toLowerCase();
    const matchBusca =
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (isMaster && (a.municipio?.toLowerCase().includes(q) ?? false));

    const matchRisco = filtroRisco === 'todos' ||
      (filtroRisco === 'alto' && a.alto > 0) ||
      (filtroRisco === 'medio' && a.medio > 0) ||
      (filtroRisco === 'baixo' && a.baixo > 0);

    const matchMunicipio = !isMaster || filtroMunicipio === 'todos' || a.municipio === filtroMunicipio;

    const matchSupervisor = !isMaster || filtroSupervisor === 'todos' ||
      (atribuicoesMap[filtroSupervisor]?.includes(a.uid) ?? false);

    return matchBusca && matchRisco && matchMunicipio && matchSupervisor;
  });

  const hasFilters = busca.length > 0 || filtroRisco !== 'todos' || filtroMunicipio !== 'todos' || filtroSupervisor !== 'todos';

  const clearAll = () => {
    setBusca('');
    setFiltroRisco('todos');
    setFiltroMunicipio('todos');
    setFiltroSupervisor('todos');
  };

  // Dropdown options
  const riscoOpts: DropdownOption[] = [
    { label: 'Todos os riscos', value: 'todos' },
    { label: 'Alto Risco', value: 'alto', color: '#EF4444' },
    { label: 'Médio Risco', value: 'medio', color: '#F59E0B' },
    { label: 'Baixo Risco', value: 'baixo', color: '#10B981' },
  ];

  const municipioOpts: DropdownOption[] = [
    { label: 'Todos os municípios', value: 'todos' },
    ...municipios.map(m => ({ label: m, value: m })),
  ];

  const supervisorOpts: DropdownOption[] = [
    { label: 'Todos os supervisores', value: 'todos' },
    ...supervisoresFiltrados.map(s => ({ label: s.name, value: s.uid })),
  ];

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
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Equipe</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {filtrados.length} de {agentes.length} agente{agentes.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {hasFilters && (
          <TouchableOpacity
            style={[styles.clearBtn, { backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}25` }]}
            onPress={clearAll}
          >
            <Feather name="x" size={14} color={theme.primary} />
            <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700' }}>Limpar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Barra de busca + filtros */}
      <View style={[styles.searchSection, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        {/* Campo de busca */}
        <View style={[styles.searchInput, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchText, { color: theme.text }]}
            value={busca}
            onChangeText={setBusca}
            placeholder={isMaster ? 'Nome, e-mail ou município...' : 'Buscar agente...'}
            placeholderTextColor={theme.textSecondary}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x-circle" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Linha de dropdowns */}
        <View style={styles.filtersRow}>
          {/* Risco */}
          <Dropdown
            label="Risco"
            value={filtroRisco}
            options={riscoOpts}
            onSelect={v => setFiltroRisco(v as FiltroRisco)}
            icon="alert-triangle"
            accentColor={
              filtroRisco === 'alto' ? '#EF4444' :
              filtroRisco === 'medio' ? '#F59E0B' :
              filtroRisco === 'baixo' ? '#10B981' :
              theme.primary
            }
          />

          {/* Município — só Master Admin */}
          {isMaster && municipios.length > 0 && (
            <Dropdown
              label="Município"
              value={filtroMunicipio}
              options={municipioOpts}
              onSelect={v => { setFiltroMunicipio(v); setFiltroSupervisor('todos'); }}
              icon="map-pin"
              accentColor={theme.primary}
            />
          )}

          {/* Supervisor — só Master Admin */}
          {isMaster && supervisoresFiltrados.length > 0 && (
            <Dropdown
              label="Supervisor"
              value={filtroSupervisor}
              options={supervisorOpts}
              onSelect={setFiltroSupervisor}
              icon="user-check"
              accentColor="#8B5CF6"
            />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}>
        {filtrados.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <Feather name="users" size={36} color={theme.textSecondary} style={{ marginBottom: 12, opacity: 0.4 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum agente encontrado</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Tente ajustar os filtros ou limpar a busca.
            </Text>
            {hasFilters && (
              <TouchableOpacity
                style={[styles.clearBtnFull, { backgroundColor: `${theme.primary}15` }]}
                onPress={clearAll}
              >
                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>Limpar todos os filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtrados.map(agente => (
            <TouchableOpacity
              key={agente.uid}
              style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              onPress={() => router.push(`/(panel)/agente?uid=${agente.uid}`)}
              activeOpacity={0.75}
            >
              {/* Avatar */}
              <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
                <Text style={styles.avatarText}>{agente.name[0]?.toUpperCase() || '?'}</Text>
              </View>

              {/* Info */}
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.agenteName, { color: theme.text }]} numberOfLines={1}>{agente.name}</Text>
                <Text style={[styles.agenteEmail, { color: theme.textSecondary }]} numberOfLines={1}>{agente.email}</Text>

                {/* Badges de município e supervisor (master) */}
                {isMaster && (agente.municipio || agente.supervisor) && (
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    {agente.municipio && (
                      <View style={[styles.tagChip, { backgroundColor: `${theme.primary}12` }]}>
                        <Feather name="map-pin" size={9} color={theme.primary} />
                        <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '700' }}>
                          {agente.municipio}
                        </Text>
                      </View>
                    )}
                    {agente.supervisor && (
                      <View style={[styles.tagChip, { backgroundColor: `${theme.border}` }]}>
                        <Feather name="user" size={9} color={theme.textSecondary} />
                        <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: '600' }} numberOfLines={1}>
                          {agente.supervisor}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Stats de risco */}
                <View style={styles.statsRow}>
                  <View style={[styles.statChip, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>{agente.alto}🔴</Text>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                    <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '700' }}>{agente.medio}🟡</Text>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                    <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '700' }}>{agente.baixo}🟢</Text>
                  </View>
                </View>
              </View>

              {/* Contagem + tempo */}
              <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                <Text style={[styles.totalCount, { color: theme.primary }]}>{agente.total}</Text>
                <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>30d</Text>
                <Text style={[styles.ultimaAt, { color: theme.textSecondary }]}>{tempoRelativo(agente.ultima)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, gap: 12,
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
  },

  // Search section
  searchSection: { padding: 14, gap: 10, borderBottomWidth: 1 },
  searchInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 46,
  },
  searchText: { flex: 1, fontSize: 15 },
  filtersRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  // Dropdown button
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
    flexShrink: 0,
  },
  dropdownBtnText: { fontSize: 12, fontWeight: '600', maxWidth: 110 },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0,
    paddingTop: 12, paddingHorizontal: 20,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderRadius: 12, paddingHorizontal: 8,
    marginBottom: 2,
  },
  modalOptionDot: {
    width: 10, height: 10, borderRadius: 5, borderWidth: 1.5,
  },
  modalOptionText: { flex: 1, fontSize: 15 },

  // Cards
  scrollContent: { padding: 16, paddingBottom: 60 },
  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    borderWidth: 1, padding: 14, marginBottom: 10,
  },
  avatarCircle: {
    width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 19, fontWeight: '800', color: '#FFF' },
  agenteName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  agenteEmail: { fontSize: 12, marginBottom: 8 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  statsRow: { flexDirection: 'row', gap: 6 },
  statChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  totalCount: { fontSize: 24, fontWeight: '900' },
  totalLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  ultimaAt: { fontSize: 10, marginTop: 4, textAlign: 'right' },

  // Empty
  emptyCard: {
    borderRadius: 16, borderWidth: 1, padding: 40, alignItems: 'center', marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  clearBtnFull: {
    marginTop: 16, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12,
  },
});
