import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Modal,
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
import { AppHeader, Button, ConfirmSheet, EmptyState, FormField, ListRow, LoadingState } from '../../../components/ui';
import { Spacing } from '../../../constants/Spacing';

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
  const [deleteCandidate, setDeleteCandidate] = useState<GrupoLocal | null>(null);

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
    setDeleteCandidate(g);
  };

  const excluirGrupo = () => {
    if (!deleteCandidate) return;
    deleteGrupo(deleteCandidate.id);
    setDeleteCandidate(null);
    carregar();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LoadingState message="Carregando grupos de campo..." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppHeader
        title="Grupos de campo"
        subtitle={`${profile?.municipio || 'Município'} · ${grupos.length} grupo${grupos.length !== 1 ? 's' : ''}`}
        onBack={() => router.back()}
        actionIcon="plus"
        actionLabel="Criar grupo"
        onAction={() => { setNomeGrupo(''); setModalVisible(true); }}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        {grupos.length === 0 ? (
          <EmptyState
            icon="users"
            title="Sem grupos cadastrados"
            description="Crie grupos para organizar agentes por área, turno ou zona de atuação."
            actionLabel="Criar primeiro grupo"
            onAction={() => { setNomeGrupo(''); setModalVisible(true); }}
          />
        ) : (
          grupos.map(g => (
            <View
              key={g.id}
              style={styles.groupRow}
            >
              <View style={styles.groupMain}>
                <ListRow
                  title={g.nome}
                  subtitle={`${g.membros} membro${g.membros !== 1 ? 's' : ''}`}
                  icon="users"
                  onPress={() => router.push(`/(panel)/grupos/${g.id}` as any)}
                />
              </View>
              <TouchableOpacity
                onPress={() => confirmarExcluir(g)}
                style={[styles.deleteBtn, { backgroundColor: theme.errorLight }]}
                accessibilityLabel={`Excluir ${g.nome}`}
              >
                <Feather name="trash-2" size={16} color={theme.error} />
              </TouchableOpacity>
            </View>
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
              <FormField
                label="Nome do grupo"
                required
                placeholder="Ex: Equipe Norte, Plantão A..."
                value={nomeGrupo}
                onChangeText={setNomeGrupo}
                autoFocus
              />
              <Button
                label="Criar grupo"
                onPress={criarGrupo}
                disabled={saving || !nomeGrupo.trim()}
                loading={saving}
                fullWidth
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <ConfirmSheet
        visible={Boolean(deleteCandidate)}
        title="Excluir grupo?"
        description={`Os membros serão removidos de “${deleteCandidate?.nome || ''}”.`}
        onDismiss={() => setDeleteCandidate(null)}
        actions={[
          { label: 'Excluir grupo', variant: 'danger', onPress: excluirGrupo },
          { label: 'Cancelar', variant: 'ghost', onPress: () => setDeleteCandidate(null) },
        ]}
      />
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
  scrollContent: { padding: Spacing[4], paddingBottom: 100 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: Spacing[2] },
  groupMain: { flex: 1 },
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
  modalContent: { padding: 20, paddingBottom: 40, gap: Spacing[4] },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, fontWeight: '500' },
  saveBtn: {
    marginTop: 20, borderRadius: 16, padding: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
