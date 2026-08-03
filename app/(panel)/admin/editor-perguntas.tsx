import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { generateUUID } from '../../../utils/uuid';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AppHeader, Badge, Button, StateBanner } from '../../../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TCSPalette } from '../../../constants/Colors';

// ─── Types ──────────────────────────────────────────────────────────────────

type TipoPergunta = 'cards' | 'multipla_escolha' | 'texto' | 'foto';

interface OpcaoModel {
  id: string;
  texto: string;
  pesoRisco: number;
}

interface PerguntaModel {
  id: string;
  texto: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  grupo: string;
  opcoes: OpcaoModel[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gerarId(): string {
  return generateUUID();
}

function perguntaVazia(): PerguntaModel {
  return {
    id: gerarId(),
    texto: '',
    tipo: 'cards',
    obrigatoria: false,
    grupo: '',
    opcoes: [],
  };
}

function opcaoVazia(): OpcaoModel {
  return { id: gerarId(), texto: '', pesoRisco: 0 };
}

const TIPO_LABELS: Record<TipoPergunta, string> = {
  cards: 'Cards',
  multipla_escolha: 'Lista',
  texto: 'Texto',
  foto: 'Foto',
};

const TIPO_ICONS: Record<TipoPergunta, string> = {
  cards: 'grid',
  multipla_escolha: 'list',
  texto: 'type',
  foto: 'camera',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function EditorPerguntasScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; titulo: string }>();
  const formId = params.id as string;
  const formTitulo = params.titulo as string;

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [perguntas, setPerguntas] = useState<PerguntaModel[]>([]);
  const [statusForm, setStatusForm] = useState<string>('rascunho');
  const [versaoAtual, setVersaoAtual] = useState<number>(1);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [classificacao, setClassificacao] = useState<any>(null);
  const [tipoCalculo, setTipoCalculo] = useState<string>('soma_total');
  const [erro, setErro] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    carregarFormulario();
  }, [formId]);

  const carregarFormulario = async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from('formularios')
        .select('perguntas, status, versao, classificacao, "tipoCalculo"')
        .eq('id', formId)
        .single();

      if (error) throw error;

      const raw = data?.perguntas;
      const lista: PerguntaModel[] = Array.isArray(raw)
        ? raw.map((p: any) => ({
            id: p.id ?? gerarId(),
            texto: p.texto ?? '',
            tipo: p.tipo ?? 'cards',
            obrigatoria: p.obrigatoria ?? false,
            grupo: p.grupo ?? '',
            opcoes: Array.isArray(p.opcoes)
              ? p.opcoes.map((o: any) => ({
                  id: o.id ?? gerarId(),
                  texto: o.texto ?? '',
                  pesoRisco: typeof o.pesoRisco === 'number' ? o.pesoRisco : 0,
                }))
              : [],
          }))
        : [];

      setPerguntas(lista);
      setStatusForm(data?.status ?? 'rascunho');
      setVersaoAtual(data?.versao ?? 1);
      setClassificacao(data?.classificacao ?? null);
      setTipoCalculo((data as any)?.tipoCalculo ?? 'soma_total');
    } catch (e: any) {
      logger.error('form', 'Erro ao carregar perguntas', { erro: String(e) });
      setErro('Não foi possível carregar as perguntas.');
    } finally {
      setLoading(false);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const salvar = async () => {
    const invalidIdx = perguntas.findIndex(p => {
      const precisaOpcoes = p.tipo === 'cards' || p.tipo === 'multipla_escolha';
      return !p.texto.trim() || (precisaOpcoes && (p.opcoes.length === 0 || p.opcoes.some(o => !o.texto.trim())));
    });
    if (invalidIdx >= 0) {
      setEditingIdx(invalidIdx);
      Alert.alert(
        'Pergunta incompleta',
        `Revise a pergunta ${invalidIdx + 1}. Informe o texto${perguntas[invalidIdx].tipo === 'cards' || perguntas[invalidIdx].tipo === 'multipla_escolha' ? ' e todas as opções de resposta' : ''}.`,
      );
      return;
    }
    setSalvando(true);
    try {
      const novaVersao =
        statusForm === 'publicado' ? versaoAtual + 1 : versaoAtual;

      const updates: any = {
        perguntas,
        versao: novaVersao,
        atualizadoEm: new Date().toISOString(),
        tipoCalculo,
        ...(classificacao !== null && { classificacao }),
      };

      const { error } = await supabase
        .from('formularios')
        .update(updates)
        .eq('id', formId);

      if (error) throw error;

      setVersaoAtual(novaVersao);
      logger.info('form', 'Perguntas salvas', {
        id: formId,
        qtd: perguntas.length,
        versao: novaVersao,
      });

      Alert.alert(
        'Salvo!',
        statusForm === 'publicado'
          ? `Formulário atualizado para v${novaVersao}.`
          : 'Perguntas salvas com sucesso.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      logger.error('form', 'Erro ao salvar perguntas', { erro: String(e) });
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  // ── Question CRUD ─────────────────────────────────────────────────────────

  const adicionarPergunta = () => {
    const nova = perguntaVazia();
    const novaLista = [...perguntas, nova];
    setPerguntas(novaLista);
    setEditingIdx(novaLista.length - 1);
  };

  const deletarPergunta = (idx: number) => {
    Alert.alert(
      'Remover pergunta?',
      `"${perguntas[idx].texto || 'Pergunta ' + (idx + 1)}" será removida.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            const novaLista = perguntas.filter((_, i) => i !== idx);
            setPerguntas(novaLista);
            if (editingIdx === idx) setEditingIdx(null);
            else if (editingIdx !== null && editingIdx > idx) {
              setEditingIdx(editingIdx - 1);
            }
          },
        },
      ]
    );
  };

  const moverCima = (idx: number) => {
    if (idx === 0) return;
    const novaLista = [...perguntas];
    [novaLista[idx - 1], novaLista[idx]] = [novaLista[idx], novaLista[idx - 1]];
    setPerguntas(novaLista);
    if (editingIdx === idx) setEditingIdx(idx - 1);
    else if (editingIdx === idx - 1) setEditingIdx(idx);
  };

  const moverBaixo = (idx: number) => {
    if (idx === perguntas.length - 1) return;
    const novaLista = [...perguntas];
    [novaLista[idx], novaLista[idx + 1]] = [novaLista[idx + 1], novaLista[idx]];
    setPerguntas(novaLista);
    if (editingIdx === idx) setEditingIdx(idx + 1);
    else if (editingIdx === idx + 1) setEditingIdx(idx);
  };

  const atualizarPergunta = (idx: number, patch: Partial<PerguntaModel>) => {
    setPerguntas(prev =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    );
  };

  // ── Opcao CRUD ────────────────────────────────────────────────────────────

  const adicionarOpcao = (pergIdx: number) => {
    const p = perguntas[pergIdx];
    atualizarPergunta(pergIdx, { opcoes: [...p.opcoes, opcaoVazia()] });
  };

  const deletarOpcao = (pergIdx: number, opcIdx: number) => {
    const p = perguntas[pergIdx];
    atualizarPergunta(pergIdx, {
      opcoes: p.opcoes.filter((_, i) => i !== opcIdx),
    });
  };

  const atualizarOpcao = (
    pergIdx: number,
    opcIdx: number,
    patch: Partial<OpcaoModel>
  ) => {
    const p = perguntas[pergIdx];
    atualizarPergunta(pergIdx, {
      opcoes: p.opcoes.map((o, i) => (i === opcIdx ? { ...o, ...patch } : o)),
    });
  };

  const ajustarPeso = (pergIdx: number, opcIdx: number, delta: number) => {
    const p = perguntas[pergIdx];
    const atual = p.opcoes[opcIdx].pesoRisco;
    const novo = Math.min(100, Math.max(0, atual + delta));
    atualizarOpcao(pergIdx, opcIdx, { pesoRisco: novo });
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderTipoBadge = (tipo: TipoPergunta, small?: boolean) => {
    const cor = theme.primary;
    return (
      <View
        style={[
          styles.tipoBadge,
          { backgroundColor: cor + '22', borderColor: cor + '44' },
          small && { paddingHorizontal: 6, paddingVertical: 2 },
        ]}
      >
        <Feather
          name={TIPO_ICONS[tipo] as any}
          size={small ? 10 : 12}
          color={cor}
        />
        <Text style={[styles.tipoBadgeText, { color: cor }, small && { fontSize: 10 }]}>
          {TIPO_LABELS[tipo]}
        </Text>
      </View>
    );
  };

  const renderOpcaoRow = (
    pergIdx: number,
    opc: OpcaoModel,
    opcIdx: number
  ) => (
    <View
      key={opc.id}
      style={[styles.opcaoRow, { borderColor: theme.border }]}
    >
      <TextInput
        style={[
          styles.opcaoInput,
          { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
        ]}
        value={opc.texto}
        onChangeText={t => atualizarOpcao(pergIdx, opcIdx, { texto: t })}
        placeholder={`Opção ${opcIdx + 1}`}
        placeholderTextColor={theme.textSecondary}
      />
      <View style={styles.pesoRow}>
        <TouchableOpacity
          style={[styles.pesoBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => ajustarPeso(pergIdx, opcIdx, -5)}
        >
          <Text style={[styles.pesoBtnText, { color: theme.text }]}>-5</Text>
        </TouchableOpacity>
        <View style={[styles.pesoDisplay, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
          <Text style={[styles.pesoValue, { color: theme.text }]}>{opc.pesoRisco}</Text>
        </View>
        <TouchableOpacity
          style={[styles.pesoBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => ajustarPeso(pergIdx, opcIdx, +5)}
        >
          <Text style={[styles.pesoBtnText, { color: theme.text }]}>+5</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.opcaoDeleteBtn, { backgroundColor: theme.errorLight }]}
        onPress={() => deletarOpcao(pergIdx, opcIdx)}
      >
        <Feather name="trash-2" size={14} color={theme.error} />
      </TouchableOpacity>
    </View>
  );

  const renderPerguntaCard = (p: PerguntaModel, idx: number) => {
    const isEditing = editingIdx === idx;
    const temOpcoes = p.tipo === 'cards' || p.tipo === 'multipla_escolha';

    return (
      <View
        key={p.id}
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: isEditing ? theme.primary : theme.cardBorder,
            borderWidth: isEditing ? 2 : 1,
            borderRadius: 14,
          },
        ]}
      >
        {/* ── Collapsed header ── */}
        <View style={styles.cardHeader}>
          <View style={[styles.numBadge, { backgroundColor: theme.iconBackground }]}>
            <Text style={[styles.numText, { color: theme.primary }]}>{idx + 1}</Text>
          </View>

          <View style={styles.cardHeaderInfo}>
            <Text
              style={[styles.cardTextoPreview, { color: theme.text }]}
              numberOfLines={1}
            >
              {p.texto || '(sem texto)'}
            </Text>
            <View style={styles.cardHeaderMeta}>
              {renderTipoBadge(p.tipo, true)}
              {p.obrigatoria && (
                <Badge label="Obrigatória" variant="warning" size="sm" />
              )}
              {p.grupo ? (
                <Text style={[styles.grupoPreview, { color: theme.textSecondary }]}>
                  {p.grupo}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.iconBtn, { opacity: idx === 0 ? 0.3 : 1 }]}
              onPress={() => moverCima(idx)}
              disabled={idx === 0}
            >
              <Feather name="chevron-up" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { opacity: idx === perguntas.length - 1 ? 0.3 : 1 }]}
              onPress={() => moverBaixo(idx)}
              disabled={idx === perguntas.length - 1}
            >
              <Feather name="chevron-down" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.iconBtn,
                {
                  backgroundColor: isEditing ? theme.primary + '22' : theme.iconBackground,
                },
              ]}
              onPress={() => setEditingIdx(isEditing ? null : idx)}
            >
              <Feather
                name={isEditing ? 'chevron-up' : 'edit-2'}
                size={16}
                color={isEditing ? theme.primary : theme.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: theme.errorLight }]}
              onPress={() => deletarPergunta(idx)}
            >
              <Feather name="trash-2" size={16} color={theme.error} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Expanded editor ── */}
        {isEditing && (
          <View style={[styles.editorBody, { borderTopColor: theme.border }]}>
            {/* Texto */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>Texto da Pergunta *</Text>
            <TextInput
              style={[
                styles.input,
                styles.inputMultiline,
                { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
              ]}
              value={p.texto}
              onChangeText={t => atualizarPergunta(idx, { texto: t })}
              placeholder="Digite o texto da pergunta"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
            />

            {/* Tipo */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>Tipo de Resposta</Text>
            <View style={styles.tipoRow}>
              {(['cards', 'multipla_escolha', 'texto', 'foto'] as TipoPergunta[]).map(t => {
                const selected = p.tipo === t;
                const cor = theme.primary;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.tipoChip,
                      {
                        backgroundColor: selected ? cor + '22' : theme.iconBackground,
                        borderColor: selected ? cor : theme.border,
                        borderWidth: selected ? 1.5 : 1,
                      },
                    ]}
                    onPress={() => {
                      atualizarPergunta(idx, {
                        tipo: t,
                        opcoes:
                          t !== 'cards' && t !== 'multipla_escolha' ? [] : p.opcoes,
                      });
                    }}
                  >
                    <Feather name={TIPO_ICONS[t] as any} size={13} color={selected ? cor : theme.textSecondary} />
                    <Text
                      style={[
                        styles.tipoChipText,
                        { color: selected ? cor : theme.textSecondary },
                      ]}
                    >
                      {TIPO_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: theme.textSecondary }]}>Regra de preenchimento</Text>
            <View style={styles.requiredGrid}>
              {[
                { value: true, label: 'Obrigatória', description: 'Bloqueia o avanço sem resposta', icon: 'lock' as const },
                { value: false, label: 'Opcional', description: 'Pode ser ignorada pelo agente', icon: 'unlock' as const },
              ].map(option => {
                const selected = p.obrigatoria === option.value;
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.requiredCard,
                      {
                        backgroundColor: selected ? theme.secondary : theme.background,
                        borderColor: selected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => atualizarPergunta(idx, { obrigatoria: option.value })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Feather name={option.icon} size={18} color={selected ? theme.primary : theme.textSecondary} />
                    <Text style={[styles.requiredTitle, { color: theme.text }]}>{option.label}</Text>
                    <Text style={[styles.requiredDescription, { color: theme.textSecondary }]}>{option.description}</Text>
                    {selected ? <Feather name="check-circle" size={17} color={theme.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Grupo */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>Grupo / Fase (opcional)</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
              ]}
              value={p.grupo}
              onChangeText={g => atualizarPergunta(idx, { grupo: g })}
              placeholder="Ex: Cobertura, Estrutura, Fundação..."
              placeholderTextColor={theme.textSecondary}
            />

            {/* Opções */}
            {temOpcoes && (
              <View style={styles.opcoesSection}>
                <View style={styles.opcoesTitleRow}>
                  <Feather name="list" size={14} color={theme.textSecondary} />
                  <Text style={[styles.opcoesTitle, { color: theme.text }]}>
                    Opções ({p.opcoes.length})
                  </Text>
                  <Text style={[styles.pesoHeader, { color: theme.textSecondary }]}>Peso 0–100</Text>
                </View>

                {p.opcoes.length === 0 && (
                  <Text style={[styles.semOpcoes, { color: theme.textSecondary }]}>
                    Nenhuma opção adicionada ainda.
                  </Text>
                )}

                {p.opcoes.map((opc, oi) => renderOpcaoRow(idx, opc, oi))}

                <TouchableOpacity
                  style={[styles.addOpcaoBtn, { borderColor: theme.primary, backgroundColor: theme.primary + '11' }]}
                  onPress={() => adicionarOpcao(idx)}
                >
                  <Feather name="plus" size={15} color={theme.primary} />
                  <Text style={[styles.addOpcaoBtnText, { color: theme.primary }]}>
                    Adicionar Opção
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Close button */}
            <TouchableOpacity
              style={[styles.collapseBtn, { backgroundColor: theme.iconBackground }]}
              onPress={() => setEditingIdx(null)}
            >
              <Feather name="chevron-up" size={16} color={theme.textSecondary} />
              <Text style={[styles.collapseBtnText, { color: theme.textSecondary }]}>Recolher</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderPreviewModal = () => (
    <Modal
      visible={previewVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setPreviewVisible(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
          <View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Pré-visualização</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {formTitulo} · {perguntas.length} pergunta{perguntas.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.modalCloseBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
            onPress={() => setPreviewVisible(false)}
          >
            <Feather name="x" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalScroll}>
          {perguntas.length === 0 && (
            <Text style={[styles.semOpcoes, { color: theme.textSecondary, textAlign: 'center', marginTop: 40 }]}>
              Nenhuma pergunta adicionada.
            </Text>
          )}
          {perguntas.map((p, idx) => (
            <View
              key={p.id}
              style={[styles.previewCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
            >
              <View style={styles.previewCardTop}>
                <View style={[styles.numBadge, { backgroundColor: theme.primary + '22' }]}>
                  <Text style={[styles.numText, { color: theme.primary }]}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewTexto, { color: theme.text }]}>{p.texto || '(sem texto)'}</Text>
                  <View style={styles.previewMeta}>
                    {renderTipoBadge(p.tipo, true)}
                    {p.obrigatoria ? <Badge label="Obrigatória" variant="warning" size="sm" /> : null}
                    {p.grupo ? (
                      <Text style={[styles.grupoPreview, { color: theme.textSecondary }]}>{p.grupo}</Text>
                    ) : null}
                  </View>
                </View>
              </View>

              {p.opcoes.length > 0 && (
                <View style={[styles.previewOpcoes, { borderTopColor: theme.border }]}>
                  {p.opcoes.map((o, oi) => (
                    <View key={o.id} style={styles.previewOpcaoRow}>
                      <Text style={[styles.previewOpcaoTexto, { color: theme.text }]}>
                        {oi + 1}. {o.texto || '(sem texto)'}
                      </Text>
                      <View style={[styles.pesoTag, { backgroundColor: getPesoColor(o.pesoRisco) + '22', borderColor: getPesoColor(o.pesoRisco) + '44' }]}>
                        <Text style={[styles.pesoTagText, { color: getPesoColor(o.pesoRisco) }]}>
                          {o.pesoRisco}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return <LoadingState message="Carregando perguntas..." />;
  }

  if (erro) {
    return <ErrorState message={erro} onRetry={carregarFormulario} />;
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title={formTitulo}
          subtitle={`${perguntas.length} ${perguntas.length === 1 ? 'pergunta' : 'perguntas'} · versão ${versaoAtual}`}
          onBack={() => router.back()}
        />
        <View style={[styles.toolbar, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
          <Badge label={statusForm === 'publicado' ? 'Publicado' : 'Rascunho'} variant={statusForm === 'publicado' ? 'success' : 'neutral'} />
          <View style={styles.toolbarActions}>
            <Button label="Prévia" variant="secondary" size="sm" onPress={() => setPreviewVisible(true)} iconLeft={<Feather name="eye" size={16} color={theme.primary} />} />
            <Button label="Salvar" variant="primary" size="sm" onPress={salvar} loading={salvando} disabled={salvando} />
          </View>
        </View>
      </View>

      {/* ── Aviso versão ── */}
      {statusForm === 'publicado' && (
        <View style={styles.bannerWrap}>
          <StateBanner title={`Nova versão ao salvar`} description={`Este formulário está publicado. A alteração será registrada como versão ${versaoAtual + 1}.`} variant="warning" />
        </View>
      )}

      {/* ── Questions list ── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {perguntas.length === 0 && (
          <EmptyState
            icon="list"
            title="Nenhuma pergunta"
            description="Adicione perguntas ao formulário."
            actionLabel="Adicionar Pergunta"
            onAction={adicionarPergunta}
          />
        )}

        {perguntas.map((p, idx) => renderPerguntaCard(p, idx))}

        {/* Add button */}
        <TouchableOpacity
          style={[styles.addPerguntaBtn, { backgroundColor: theme.primary }]}
          onPress={adicionarPergunta}
        >
          <Feather name="plus-circle" size={20} color="#FFF" />
          <Text style={styles.addPerguntaBtnText}>Adicionar Pergunta</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Preview modal ── */}
      {renderPreviewModal()}
    </KeyboardAvoidingView>
  );
}

// ─── Helper: peso color ───────────────────────────────────────────────────────

function getPesoColor(peso: number): string {
  if (peso <= 25) return TCSPalette.success;
  if (peso <= 50) return TCSPalette.warning;
  if (peso <= 75) return '#C45F2A';
  return TCSPalette.danger;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  toolbar: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1 },
  toolbarActions: { flexDirection: 'row', gap: 8 },
  bannerWrap: { paddingHorizontal: 16, paddingTop: 12 },

  // Scroll
  scroll: { padding: 16, paddingBottom: 80 },

  // Loading
  loadingText: { marginTop: 12, fontSize: 14 },

  // Empty
  emptyState: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 40,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Question card
  card: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  numBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numText: { fontSize: 14, fontWeight: '800' },
  cardHeaderInfo: { flex: 1, minWidth: 0 },
  cardTextoPreview: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  cardHeaderMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tipo badge
  tipoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  tipoBadgeText: { fontSize: 11, fontWeight: '700' },

  // Grupo preview
  grupoPreview: { fontSize: 11, fontStyle: 'italic' },

  // Editor body
  editorBody: { padding: 16, borderTopWidth: 1 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
  },
  inputMultiline: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },

  // Tipo chips
  tipoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tipoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tipoChipText: { fontSize: 12, fontWeight: '700' },

  requiredGrid: { flexDirection: 'row', gap: 10 },
  requiredCard: { flex: 1, minHeight: 126, borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  requiredTitle: { fontSize: 14, fontWeight: '700' },
  requiredDescription: { flex: 1, fontSize: 11, lineHeight: 15 },

  // Opções section
  opcoesSection: { marginTop: 16 },
  opcoesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  opcoesTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  pesoHeader: { fontSize: 11, fontWeight: '600' },
  semOpcoes: { fontSize: 13, fontStyle: 'italic', marginBottom: 10 },

  // Opção row
  opcaoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  opcaoInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 13,
  },
  pesoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pesoBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
  },
  pesoBtnText: { fontSize: 12, fontWeight: '700' },
  pesoDisplay: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
  },
  pesoValue: { fontSize: 13, fontWeight: '800' },
  opcaoDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Add opção
  addOpcaoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addOpcaoBtnText: { fontSize: 13, fontWeight: '700' },

  // Collapse button
  collapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 10,
    marginTop: 16,
  },
  collapseBtnText: { fontSize: 13, fontWeight: '600' },

  // Add pergunta
  addPerguntaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: 14,
    marginTop: 8,
  },
  addPerguntaBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Preview modal
  modalContainer: { flex: 1 },
  modalHeader: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: { padding: 16, paddingBottom: 60 },

  // Preview card
  previewCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  previewCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
  },
  previewTexto: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  previewOpcoes: { paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1 },
  previewOpcaoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  previewOpcaoTexto: { fontSize: 13, flex: 1, marginRight: 8 },
  pesoTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
  },
  pesoTagText: { fontSize: 12, fontWeight: '800' },
});
