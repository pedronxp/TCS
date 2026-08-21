import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, RefreshControl
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { registrarAuditoria } from '../../../utils/auditLogger';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AppHeader, Badge, Button, FormField, MetricCard, StateBanner } from '../../../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';

export default function FormEditorScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formularios, setFormularios] = useState<any[]>([]);
  const [criando, setCriando] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const publicados = formularios.filter(f => f.status === 'publicado').length;
  const rascunhos = formularios.length - publicados;

  const carregar = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setErro(null);
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
      setErro('Ocorreu um erro ao carregar os formulários.');
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
      const { error } = await supabase.rpc('create_operational_form', {
        p_titulo: novoTitulo.trim(),
        p_descricao: novaDescricao.trim() || null,
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
      Alert.alert('Erro', 'Não foi possível criar o formulário. Tente novamente.');
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
              const { error } = await supabase.rpc('set_operational_form_publication', {
                p_id: form.id,
                p_publicado: novoAtivo,
              });
              if (error) throw error;
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
              const { error } = await supabase.rpc('duplicate_operational_form', { p_id: form.id });
              if (error) throw error;
              carregar();
              Alert.alert('Duplicado!', 'Cópia criada como rascunho.');
            } catch (e: any) {
              Alert.alert('Erro', 'Não foi possível duplicar. Tente novamente.');
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
            const { error } = await supabase.rpc('delete_operational_form', { p_id: form.id });
            if (error) throw error;
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
    return <LoadingState message="Carregando formulários..." />;
  }

  if (erro) {
    return <ErrorState message={erro} onRetry={() => carregar(true)} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Modelos de vistoria"
          subtitle={`${formularios.length} ${formularios.length === 1 ? 'formulário' : 'formulários'}`}
          onBack={() => router.back()}
          actionIcon={showCreate ? 'x' : 'plus'}
          actionLabel={showCreate ? 'Fechar criação' : 'Novo formulário'}
          onAction={() => setShowCreate(!showCreate)}
        />
      </View>

      {showCreate && (
        <View style={[styles.createPanel, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Text style={[styles.createTitle, { color: theme.text }]}>Criar modelo</Text>
          <Text style={[styles.createDescription, { color: theme.textSecondary }]}>O novo modelo começa como rascunho e só ficará disponível após a publicação.</Text>
          <FormField
            label="Título"
            required
            value={novoTitulo}
            onChangeText={setNovoTitulo}
            placeholder="Ex.: Avaliação de edificação"
          />
          <FormField
            label="Descrição"
            value={novaDescricao}
            onChangeText={setNovaDescricao}
            placeholder="Explique quando este modelo deve ser usado"
            helperText="Opcional, mas ajuda o agente a escolher corretamente."
          />
          <Button
            label="Criar Formulário"
            iconLeft={<Feather name="check" size={18} color="#FFF" />}
            variant="primary"
            loading={salvando}
            onPress={criarFormulario}
            style={{ marginTop: 4 }}
          />
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        <View style={styles.metricsRow}>
          <MetricCard value={publicados} label="Publicados" tone="success" style={styles.metric} />
          <MetricCard value={rascunhos} label="Em preparação" tone="warning" style={styles.metric} />
        </View>
        <StateBanner
          title="Publicação controlada"
          description="Formulários em rascunho não aparecem para os agentes. Revise perguntas e pesos antes de publicar."
          variant="info"
        />
        {formularios.length === 0 ? (
          <EmptyState
            icon="edit"
            title="Nenhum formulário"
            description="Crie o primeiro formulário preenchendo o painel acima."
            actionLabel={!showCreate ? "Novo Formulário" : undefined}
            onAction={!showCreate ? () => setShowCreate(true) : undefined}
          />
        ) : (
          formularios.map(f => {
            const isPublicado = f.status === 'publicado';
            return (
              <View key={f.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.formIcon, { backgroundColor: isPublicado ? theme.successLight : theme.secondary }]}>
                    <Feather name={isPublicado ? 'clipboard' : 'edit-3'} size={20} color={isPublicado ? theme.success : theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{f.titulo}</Text>
                    {f.descricao ? <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>{f.descricao}</Text> : null}
                    <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>Versão {f.versao}</Text>
                  </View>
                  <Badge label={isPublicado ? 'Publicado' : 'Rascunho'} variant={isPublicado ? 'success' : 'neutral'} size="sm" />
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
                    <Feather name={isPublicado ? 'eye-off' : 'eye'} size={16} color={isPublicado ? theme.warning : theme.success} />
                    <Text style={[styles.actionText, { color: isPublicado ? theme.warning : theme.success }]}>
                      {isPublicado ? 'Despublicar' : 'Publicar'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.action} onPress={() => excluir(f)}>
                    <Feather name="trash-2" size={16} color={theme.error} />
                    <Text style={[styles.actionText, { color: theme.error }]}>Excluir</Text>
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
  createPanel: { padding: 20, borderBottomWidth: 1, gap: 14 },
  createTitle: { fontSize: 18, fontWeight: '800' },
  createDescription: { fontSize: 13, lineHeight: 18, marginTop: -8 },
  scroll: { padding: 16, paddingBottom: 60, gap: 16 },
  metricsRow: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1 },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  formIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardDesc: { fontSize: 13, marginBottom: 4 },
  cardMeta: { fontSize: 12 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1 },
  action: {
    width: '50%', minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 12,
  },
  actionText: { fontSize: 13, fontWeight: '700' },
  empty: { borderRadius: 20, borderWidth: 1, padding: 40, alignItems: 'center', marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
