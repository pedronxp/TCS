import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import {
  GrupoLocal, GrupoMembro,
  getMembrosGrupo, addMembroGrupo, removeMembroGrupo, getGruposByMunicipio,
} from '../../../utils/database';

interface AgentUser { uid: string; name: string; }

export default function GrupoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [grupo, setGrupo] = useState<GrupoLocal | null>(null);
  const [membros, setMembros] = useState<GrupoMembro[]>([]);
  const [agentesDisponiveis, setAgentesDisponiveis] = useState<AgentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAgentes, setLoadingAgentes] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    try {
      const grupos = getGruposByMunicipio(profile?.municipio ?? '');
      const g = grupos.find(x => x.id === id);
      if (g) setGrupo(g);
      setMembros(getMembrosGrupo(id as string));
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const carregarAgentesDisponiveis = async () => {
    setLoadingAgentes(true);
    try {
      const { data } = await supabase
        .from('users')
        .select('uid, name')
        .eq('role', 'agent')
        .eq('isApproved', true)
        .eq('municipio', profile?.municipio ?? '');
      if (data) {
        const uidsJaMembros = new Set(membros.map(m => m.agente_uid));
        setAgentesDisponiveis((data as AgentUser[]).filter(a => !uidsJaMembros.has(a.uid)));
      }
    } finally {
      setLoadingAgentes(false);
    }
  };

  const adicionarMembro = (agente: AgentUser) => {
    addMembroGrupo({ grupo_id: id as string, agente_uid: agente.uid, agente_nome: agente.name });
    setShowPicker(false);
    carregar();
  };

  const confirmarRemover = (m: GrupoMembro) => {
    Alert.alert(
      'Remover membro',
      `Remover ${m.agente_nome} do grupo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: () => { removeMembroGrupo(id as string, m.agente_uid); carregar(); },
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{grupo?.nome ?? 'Grupo'}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {membros.length} membro{membros.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => { setShowPicker(true); carregarAgentesDisponiveis(); }}
        >
          <Feather name="user-plus" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {membros.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            <Feather name="user-plus" size={36} color={theme.border} style={{ marginBottom: 12, opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum membro</Text>
            <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
              Adicione agentes a este grupo tocando em +
            </Text>
          </View>
        ) : (
          membros.map(m => (
            <View
              key={m.agente_uid}
              style={[styles.membroCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
            >
              <View style={[styles.avatar, { backgroundColor: `${theme.primary}15` }]}>
                <Text style={[styles.avatarText, { color: theme.primary }]}>
                  {m.agente_nome[0]?.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.membroNome, { color: theme.text }]}>{m.agente_nome}</Text>
              <TouchableOpacity
                onPress={() => confirmarRemover(m)}
                style={[styles.removeBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]}
              >
                <Feather name="x" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Picker de agentes */}
      {showPicker && (
        <View style={[styles.pickerOverlay, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Adicionar Agente</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {loadingAgentes ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : agentesDisponiveis.length === 0 ? (
              <Text style={[styles.pickerEmpty, { color: theme.textSecondary }]}>
                Todos os agentes já são membros.
              </Text>
            ) : (
              agentesDisponiveis.map(a => (
                <TouchableOpacity
                  key={a.uid}
                  style={[styles.pickerItem, { borderBottomColor: theme.border }]}
                  onPress={() => adicionarMembro(a)}
                >
                  <View style={[styles.pickerAvatar, { backgroundColor: `${theme.primary}15` }]}>
                    <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '800' }}>
                      {a.name[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.pickerNome, { color: theme.text }]}>{a.name}</Text>
                  <Feather name="plus" size={18} color={theme.primary} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  addBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  scrollContent: { padding: 20, paddingBottom: 100 },
  emptyCard: {
    borderRadius: 20, borderWidth: 1, padding: 40,
    alignItems: 'center', marginTop: 40,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  membroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  avatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  membroNome: { flex: 1, fontSize: 15, fontWeight: '700' },
  removeBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  pickerOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '60%', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1,
  },
  pickerTitle: { fontSize: 16, fontWeight: '800' },
  pickerEmpty: { padding: 20, textAlign: 'center', fontSize: 14 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1,
  },
  pickerAvatar: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  pickerNome: { flex: 1, fontSize: 14, fontWeight: '600' },
});
