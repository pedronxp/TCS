import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import {
  GrupoLocal, insertGrupo, getGruposByMunicipio,
  deleteGrupo, getGrupoMemberCount,
} from '../../../utils/database';
import { generateUUID } from '../../../utils/uuid';

export default function GruposScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile } = useAuth();

  const [grupos, setGrupos] = useState<(GrupoLocal & { membros: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [nomeGrupo, setNomeGrupo] = useState('');
  const [saving, setSaving] = useState(false);

  const carregar = (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const municipio = profile?.municipio ?? '';
      const lista = getGruposByMunicipio(municipio);
      setGrupos(lista.map(g => ({ ...g, membros: getGrupoMemberCount(g.id) })));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, [profile]));

  const criarGrupo = () => {
    if (!nomeGrupo.trim()) return;
    setSaving(true);
    try {
      const grupo: GrupoLocal = {
        id: generateUUID(),
        nome: nomeGrupo.trim(),
        municipio: profile?.municipio ?? '',
        criado_em: new Date().toISOString(),
      };
      insertGrupo(grupo);
      setModalVisible(false);
      setNomeGrupo('');
      carregar();
    } catch {
      Alert.alert('Erro', 'Não foi possível criar o grupo.');
    } finally {
      setSaving(false);
    }
  };

  const confirmarExcluir = (g: GrupoLocal) => {
    Alert.alert(
      'Excluir grupo',
      `Tem certeza que deseja excluir "${g.nome}"? Os membros serão removidos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: () => { deleteGrupo(g.id); carregar(); },
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
          <Text style={[styles.title, { color: theme.text }]}>Grupos de Campo</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {profile?.municipio} · {grupos.length} grupo{grupos.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => { setNomeGrupo(''); setModalVisible(true); }}
        >
          <Feather name="plus" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        {grupos.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            <Feather name="users" size={40} color={theme.border} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Sem grupos cadastrados</Text>
            <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
              Crie grupos para organizar agentes por área, turno ou zona de atuação.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: theme.primary }]}
              onPress={() => { setNomeGrupo(''); setModalVisible(true); }}
            >
              <Feather name="plus" size={16} color="#FFF" />
              <Text style={styles.emptyBtnText}>Criar Primeiro Grupo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          grupos.map(g => (
            <TouchableOpacity
              key={g.id}
              style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}
              onPress={() => router.push(`/(panel)/grupos/${g.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.cardIcon, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name="users" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardNome, { color: theme.text }]}>{g.nome}</Text>
                <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                  {g.membros} membro{g.membros !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => confirmarExcluir(g)}
                  style={[styles.deleteBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]}
                >
                  <Feather name="trash-2" size={16} color="#EF4444" />
                </TouchableOpacity>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal criar grupo */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Novo Grupo</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Nome do grupo</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="Ex: Equipe Norte, Plantão A..."
                placeholderTextColor={theme.textSecondary}
                value={nomeGrupo}
                onChangeText={setNomeGrupo}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: saving || !nomeGrupo.trim() ? theme.border : theme.primary }]}
                onPress={criarGrupo}
                disabled={saving || !nomeGrupo.trim()}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.saveBtnText}>Criar Grupo</Text>
                }
              </TouchableOpacity>
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
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  emptyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10,
  },
  cardIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardNome: { fontSize: 15, fontWeight: '700' },
  cardMeta: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalContent: { padding: 20, paddingBottom: 40 },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, fontWeight: '500' },
  saveBtn: {
    marginTop: 20, borderRadius: 16, padding: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
