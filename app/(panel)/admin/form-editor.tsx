import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, RefreshControl
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { registrarAuditoria } from '../../../utils/auditLogger';

export default function FormEditorScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formularios, setFormularios] = useState<any[]>([]);
  const [criando, setCriando] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      let query = supabase
        .from('formularios')
        .select('id, titulo, descricao, versao, status, criadoEm, atualizadoEm, ativo')
        .order('atualizadoEm', { ascending: false });

      if (profile?.role !== 'master_admin' && profile?.municipio) {
        query = query.eq('municipio', profile.municipio);
      }

      const { data } = await query;
      setFormularios(data || []);
    } catch (e) {
      logger.error('form', 'Erro form editor', { erro: String(e) });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const criarFormulario = async () => {
    if (!novoTitulo.trim()) {
      Alert.alert('Atenção', 'Informe o título do formulário.');
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.from('formularios').insert({
        titulo: novoTitulo.trim(),
        descricao: novaDescricao.trim() || null,
        perguntas: [],
        versao: 1,
        status: 'rascunho',
        ativo: false,
        municipio: profile?.municipio || null,
        criadoPorNome: profile?.name || '',
        criadoPorUid: profile?.uid || '',
      });
      if (error) throw error;
      setNovoTitulo('');
      setNovaDescricao('');
      setShowCreate(false);
      carregar();
      registrarAuditoria({
        acao: 'formulario_criado',
        adminUid: profile?.uid ?? '',
        adminNome: profile?.name ?? '',
        municipio: profile?.municipio ?? '',
        alvoNome: novoTitulo.trim(),
      });
      Alert.alert('Criado!', 'Formulário criado como rascunho. Adicione perguntas na edição.');
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível criar o formulário.');
    } finally {
      setSalvando(false);
    }
  };

  const toggleStatus = async (form: any) => {
    const novoStatus = form.status === 'publicado' ? 'rascunho' : 'publicado';
    const novoAtivo = novoStatus === 'publicado';
    Alert.alert(
      novoAtivo ? 'Publicar formulário?' : 'Despublicar formulário?',
      novoAtivo
        ? 'O formulário ficará disponível para uso nas vistorias.'
        : 'O formulário deixará de aparecer para os agentes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: novoAtivo ? 'Publicar' : 'Despublicar', onPress: async () => {
            try {
              await supabase.from('formularios').update({
                status: novoStatus, ativo: novoAtivo,
                publicadoEm: novoAtivo ? new Date().toISOString() : null,
              }).eq('id', form.id);
              registrarAuditoria({
                acao: novoAtivo ? 'formulario_publicado' : 'formulario_despublicado',
                adminUid: profile?.uid ?? '',
                adminNome: profile?.name ?? '',
                municipio: profile?.municipio ?? '',
                alvoId: form.id,
                alvoNome: form.titulo,
              });
              carregar();
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível atualizar o status.');
            }
          }
        }
      ]
    );
  };

  const duplicar = async (form: any) => {
    Alert.alert(
      'Duplicar formulário?',
      `Criar uma cópia de "${form.titulo}" como rascunho?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Duplicar', onPress: async () => {
            try {
              const { data: original } = await supabase
                .from('formularios')
                .select('perguntas')
                .eq('id', form.id)
                .single();
              const { error } = await supabase.from('formularios').insert({
                titulo: `${form.titulo} (cópia)`,
                descricao: form.descricao || null,
                perguntas: original?.perguntas || [],
                versao: 1,
                status: 'rascunho',
                ativo: false,
                municipio: profile?.municipio || null,
                criadoPorNome: profile?.name || '',
                criadoPorUid: profile?.uid || '',
              });
              if (error) throw error;
              carregar();
              Alert.alert('Duplicado!', 'Cópia criada como rascunho.');
            } catch (e: any) {
              Alert.alert('Erro', e.message || 'Não foi possível duplicar.');
            }
          }
        }
      ]
    );
  };

  const excluir = (form: any) => {
    Alert.alert('Excluir formulário?', `"${form.titulo}" será permanentemente removido.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          try {
            await supabase.from('formularios').delete().eq('id', form.id);
            registrarAuditoria({
              acao: 'formulario_excluido',
              adminUid: profile?.uid ?? '',
              adminNome: profile?.name ?? '',
              municipio: profile?.municipio ?? '',
              alvoId: form.id,
              alvoNome: form.titulo,
            });
            carregar();
          } catch (e) {
            Alert.alert('Erro', 'Não foi possível excluir.');
          }
        }
      }
    ]);
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
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Editor de Formulários</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{formularios.length} formulário{formularios.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => setShowCreate(!showCreate)}
        >
          <Feather name={showCreate ? 'x' : 'plus'} size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {showCreate && (
        <View style={[styles.createPanel, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
          <Text style={[styles.createTitle, { color: theme.text }]}>Novo Formulário</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
            value={novoTitulo}
            onChangeText={setNovoTitulo}
            placeholder="Título do formulário *"
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
            value={novaDescricao}
            onChangeText={setNovaDescricao}
            placeholder="Descrição (opcional)"
            placeholderTextColor={theme.textSecondary}
          />
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: salvando ? theme.textSecondary : theme.primary }]}
            onPress={criarFormulario}
            disabled={salvando}
          >
            {salvando ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="check" size={18} color="#FFF" />}
            <Text style={styles.createBtnText}>{salvando ? 'Criando...' : 'Criar Formulário'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        {formularios.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <Feather name="file-plus" size={40} color={theme.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum formulário</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Crie um formulário personalizado para vistorias.</Text>
          </View>
        ) : (
          formularios.map(f => {
            const isPublicado = f.status === 'publicado';
            return (
              <View key={f.id} style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.statusDot, { backgroundColor: isPublicado ? '#10B981' : theme.textSecondary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{f.titulo}</Text>
                    {f.descricao ? <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>{f.descricao}</Text> : null}
                    <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                      v{f.versao} · {isPublicado ? 'Publicado' : 'Rascunho'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: isPublicado ? 'rgba(16,185,129,0.12)' : theme.iconBackground }]}>
                    <Text style={[styles.statusText, { color: isPublicado ? '#10B981' : theme.textSecondary }]}>
                      {isPublicado ? 'ATIVO' : 'RASCUNHO'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.cardActions, { borderTopColor: theme.border }]}>
                  <TouchableOpacity
                    style={styles.action}
                    onPress={() => router.push(`/(panel)/admin/editor-perguntas?id=${f.id}&titulo=${encodeURIComponent(f.titulo)}`)}
                  >
                    <Feather name="edit-2" size={16} color={theme.primary} />
                    <Text style={[styles.actionText, { color: theme.primary }]}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.action} onPress={() => duplicar(f)}>
                    <Feather name="copy" size={16} color={theme.textSecondary} />
                    <Text style={[styles.actionText, { color: theme.textSecondary }]}>Duplicar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.action} onPress={() => toggleStatus(f)}>
                    <Feather name={isPublicado ? 'eye-off' : 'eye'} size={16} color={isPublicado ? '#F59E0B' : '#10B981'} />
                    <Text style={[styles.actionText, { color: isPublicado ? '#F59E0B' : '#10B981' }]}>
                      {isPublicado ? 'Despublicar' : 'Publicar'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.action} onPress={() => excluir(f)}>
                    <Feather name="trash-2" size={16} color="#EF4444" />
                    <Text style={[styles.actionText, { color: '#EF4444' }]}>Excluir</Text>
                  </TouchableOpacity>
                </View>
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
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  createPanel: { padding: 20, borderBottomWidth: 1 },
  createTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48,
    fontSize: 15, marginBottom: 10,
  },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 50, borderRadius: 12, marginTop: 4,
  },
  createBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 60 },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardDesc: { fontSize: 13, marginBottom: 4 },
  cardMeta: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cardActions: { flexDirection: 'row', borderTopWidth: 1 },
  action: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 12,
  },
  actionText: { fontSize: 13, fontWeight: '700' },
  empty: { borderRadius: 20, borderWidth: 1, padding: 40, alignItems: 'center', marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
