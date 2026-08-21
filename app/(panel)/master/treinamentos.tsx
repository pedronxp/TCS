import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { TCSTheme } from '../../../constants/Colors';
import { AppHeader, EmptyState, MetricCard, StateBanner } from '../../../components/ui';
import {
  closeTrainingClass,
  createTrainingClass,
  formatDatePtBr,
  formatTimePtBr,
  formatTrainingToken,
  generateTrainingToken,
  isTrainingClassEnded,
  listTrainingClasses,
  listTrainingParticipants,
  normalizeTrainingToken,
  parseDateTimePtBr,
  TrainingClass,
  TrainingParticipant,
} from '../../../services/TrainingService';

type TrainingForm = {
  nome: string;
  limite: string;
  dataInicio: string;
  horaInicio: string;
  dataFim: string;
  horaFim: string;
  token: string;
};

function defaultForm(): TrainingForm {
  const inicio = new Date();
  inicio.setSeconds(0, 0);
  const fim = new Date(inicio.getTime() + 4 * 60 * 60 * 1000);
  return {
    nome: '',
    limite: '40',
    dataInicio: formatDatePtBr(inicio),
    horaInicio: formatTimePtBr(inicio),
    dataFim: formatDatePtBr(fim),
    horaFim: formatTimePtBr(fim),
    token: generateTrainingToken(),
  };
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatus(item: TrainingClass, theme: TCSTheme) {
  const now = Date.now();
  if (isTrainingClassEnded(item)) return { label: 'Encerrado', color: theme.muted, background: theme.mutedBackground, icon: 'lock' as const };
  if (now < new Date(item.inicio_em).getTime()) return { label: 'Agendado', color: theme.primary, background: theme.secondary, icon: 'clock' as const };
  return { label: 'Ativo', color: theme.success, background: theme.successLight, icon: 'radio' as const };
}

export default function MasterTreinamentosScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile } = useAuth();
  const [classes, setClasses] = useState<TrainingClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<TrainingForm>(() => defaultForm());
  const [participantsClass, setParticipantsClass] = useState<TrainingClass | null>(null);
  const [participants, setParticipants] = useState<TrainingParticipant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);

  const summary = useMemo(() => {
    const abertas = classes.filter(c => !isTrainingClassEnded(c));
    return {
      abertas: abertas.length,
      participantes: abertas.reduce((sum, c) => sum + (c.participant_count || 0), 0),
      limite: abertas.reduce((sum, c) => sum + c.limite_participantes, 0),
    };
  }, [classes]);

  const carregar = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await listTrainingClasses();
      setClasses(data);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível carregar os treinamentos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    carregar();
  }, [carregar]));

  const abrirCriacao = () => {
    setForm(defaultForm());
    setShowCreate(true);
  };

  const criarTurma = async () => {
    const nome = form.nome.trim();
    const limite = Number(form.limite);
    const inicio = parseDateTimePtBr(form.dataInicio, form.horaInicio);
    const fim = parseDateTimePtBr(form.dataFim, form.horaFim);
    const token = formatTrainingToken(form.token);

    if (nome.length < 3) {
      Alert.alert('Nome da turma', 'Informe um nome de turma com pelo menos 3 caracteres.');
      return;
    }
    if (!Number.isInteger(limite) || limite < 1 || limite > 500) {
      Alert.alert('Limite inválido', 'Informe um limite entre 1 e 500 participantes.');
      return;
    }
    if (!inicio || !fim || fim.getTime() <= inicio.getTime()) {
      Alert.alert('Período inválido', 'Confira a data/hora inicial e final do treinamento.');
      return;
    }
    if (normalizeTrainingToken(token).length !== 12) {
      Alert.alert('Token inválido', 'Gere ou informe um token com 12 caracteres.');
      return;
    }

    setCreating(true);
    try {
      await createTrainingClass({
        nome,
        token,
        limiteParticipantes: limite,
        inicioEm: inicio.toISOString(),
        fimEm: fim.toISOString(),
      });
      setShowCreate(false);
      await carregar(true);
      Alert.alert('Turma criada', `Token: ${token}`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível criar a turma.');
    } finally {
      setCreating(false);
    }
  };

  const copiarToken = async (token: string) => {
    await Clipboard.setStringAsync(token);
    Alert.alert('Token copiado', token);
  };

  const compartilharToken = async (item: TrainingClass) => {
    await Share.share({
      title: 'Token de Treinamento - TCS',
      message: [
        `Treinamento: ${item.nome}`,
        `Token: ${item.token}`,
        `Período: ${fmtDateTime(item.inicio_em)} até ${fmtDateTime(item.fim_em)}`,
        `Limite: ${item.limite_participantes} participantes`,
      ].join('\n'),
    });
  };

  const abrirParticipantes = async (item: TrainingClass) => {
    setParticipantsClass(item);
    setParticipants([]);
    setParticipantsLoading(true);
    try {
      setParticipants(await listTrainingParticipants(item.id));
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível carregar os participantes.');
    } finally {
      setParticipantsLoading(false);
    }
  };

  const encerrarTurma = (item: TrainingClass) => {
    Alert.alert(
      'Encerrar treinamento',
      'Participantes com esse token não conseguirão acessar novamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await closeTrainingClass(item.id);
              await carregar(true);
            } catch (e: any) {
              Alert.alert('Erro', e?.message || 'Não foi possível encerrar o treinamento.');
            }
          },
        },
      ],
    );
  };

  const updateToken = (value: string) => {
    setForm(prev => ({ ...prev, token: formatTrainingToken(value) }));
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Carregando treinamentos...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Treinamentos"
          subtitle="Turmas presenciais e acessos temporários"
          onBack={() => router.back()}
          actionIcon="plus"
          actionLabel="Criar turma"
          onAction={abrirCriacao}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={theme.primary} />}
      >
        <View style={styles.summaryRow}>
          <MetricCard value={summary.abertas} label="Turmas abertas" style={styles.summaryBox} />
          <MetricCard value={`${summary.participantes}/${summary.limite}`} label="Participantes" tone="success" style={styles.summaryBox} />
        </View>

        {classes.length === 0 ? (
          <EmptyState icon="users" title="Nenhuma turma criada" description="Crie um acesso coletivo para liberar o ambiente controlado de treinamento." actionLabel="Criar turma" onAction={abrirCriacao} />
        ) : (
          classes.map(item => {
            const status = getStatus(item, theme);
            return (
              <View key={item.id} style={[styles.classCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                <View style={styles.classHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.className, { color: theme.text }]} numberOfLines={2}>{item.nome}</Text>
                    <Text style={[styles.classMeta, { color: theme.textSecondary }]}>
                      {fmtDateTime(item.inicio_em)} até {fmtDateTime(item.fim_em)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.background, borderColor: status.background }]}>
                    <Feather name={status.icon} size={12} color={status.color} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                <View style={[styles.tokenBox, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
                  <View>
                    <Text style={[styles.tokenLabel, { color: theme.textSecondary }]}>TOKEN DA TURMA</Text>
                    <Text style={[styles.tokenText, { color: theme.text }]}>{item.token}</Text>
                  </View>
                  <View style={styles.tokenActions}>
                    <TouchableOpacity style={styles.smallIconBtn} onPress={() => copiarToken(item.token)}>
                      <Feather name="copy" size={17} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.smallIconBtn} onPress={() => compartilharToken(item)}>
                      <Feather name="share-2" size={17} color={theme.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.metricRow}>
                  <Metric label="Participantes" value={`${item.participant_count || 0}/${item.limite_participantes}`} color={theme.success} />
                  <Metric label="Criado por" value={item.criado_por_nome || 'Master'} color={theme.primary} />
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity style={[styles.secondaryBtn, { borderColor: theme.border }]} onPress={() => abrirParticipantes(item)}>
                    <Feather name="list" size={16} color={theme.textSecondary} />
                    <Text style={[styles.secondaryBtnText, { color: theme.textSecondary }]}>Participantes</Text>
                  </TouchableOpacity>
                  {!isTrainingClassEnded(item) && (
                    <TouchableOpacity style={[styles.dangerBtn, { borderColor: theme.error, backgroundColor: theme.errorLight }]} onPress={() => encerrarTurma(item)}>
                      <Feather name="x-circle" size={16} color={theme.error} />
                      <Text style={[styles.dangerBtnText, { color: theme.error }]}>Encerrar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Criar treinamento</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)} disabled={creating}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <FormInput label="Nome da turma" value={form.nome} onChangeText={nome => setForm(prev => ({ ...prev, nome }))} theme={theme} placeholder="Ex: Turma Defesa Civil - manhã" />
              <FormInput label="Limite de participantes" value={form.limite} onChangeText={limite => setForm(prev => ({ ...prev, limite: limite.replace(/\D/g, '') }))} theme={theme} keyboardType="numeric" />

              <View style={styles.formRow}>
                <FormInput label="Data inicial" value={form.dataInicio} onChangeText={dataInicio => setForm(prev => ({ ...prev, dataInicio }))} theme={theme} placeholder="dd/mm/aaaa" />
                <FormInput label="Hora inicial" value={form.horaInicio} onChangeText={horaInicio => setForm(prev => ({ ...prev, horaInicio }))} theme={theme} placeholder="hh:mm" />
              </View>
              <View style={styles.formRow}>
                <FormInput label="Data final" value={form.dataFim} onChangeText={dataFim => setForm(prev => ({ ...prev, dataFim }))} theme={theme} placeholder="dd/mm/aaaa" />
                <FormInput label="Hora final" value={form.horaFim} onChangeText={horaFim => setForm(prev => ({ ...prev, horaFim }))} theme={theme} placeholder="hh:mm" />
              </View>

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Token coletivo</Text>
              <View style={[styles.tokenInputRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.tokenInput, { color: theme.text }]}
                  value={form.token}
                  onChangeText={updateToken}
                  autoCapitalize="characters"
                  placeholder="XXXX-XXXX-XXXX"
                  placeholderTextColor={theme.textSecondary}
                />
                <TouchableOpacity onPress={() => setForm(prev => ({ ...prev, token: generateTrainingToken() }))}>
                  <Feather name="refresh-cw" size={18} color={theme.primary} />
                </TouchableOpacity>
              </View>

              <StateBanner title="Formulários liberados" description="Vistoria de deslizamento e risco estrutural novo." variant="info" />
            </ScrollView>

            <View style={[styles.modalActions, { borderTopColor: theme.border }]}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={() => setShowCreate(false)} disabled={creating}>
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: creating ? 0.7 : 1 }]} onPress={criarTurma} disabled={creating}>
                {creating ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="check" size={18} color="#FFF" />}
                <Text style={styles.saveBtnText}>Criar token</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!participantsClass} animationType="slide" transparent onRequestClose={() => setParticipantsClass(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.participantsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Participantes</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{participantsClass?.nome}</Text>
              </View>
              <TouchableOpacity onPress={() => setParticipantsClass(null)}>
                <Feather name="x" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {participantsLoading ? (
              <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 40 }} />
            ) : participants.length === 0 ? (
              <View style={styles.participantsEmpty}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nenhum participante conectado ainda.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.participantsList}>
                {participants.map((p, index) => (
                  <View key={p.id} style={[styles.participantRow, { borderBottomColor: theme.border }]}>
                    <View style={[styles.participantIndex, { backgroundColor: theme.iconBackground }]}>
                      <Text style={[styles.participantIndexText, { color: theme.textSecondary }]}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.participantName, { color: theme.text }]}>{p.nome}</Text>
                      <Text style={[styles.participantMeta, { color: theme.textSecondary }]}>
                        {p.status} - entrou em {fmtDateTime(p.entrou_em)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function FormInput({ label, theme, style, ...props }: {
  label: string;
  theme: any;
  style?: any;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={[styles.inputGroup, style]}>
      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
        placeholderTextColor={theme.textSecondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, fontWeight: '600' },
  subtitle: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  scroll: { padding: 20, gap: 14 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  summaryBox: { flex: 1 },
  emptyCard: { borderRadius: 18, borderWidth: 1, padding: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 12 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 18,
  },
  primaryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  classCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 12 },
  classHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  className: { fontSize: 16, fontWeight: '800' },
  classMeta: { fontSize: 11, marginTop: 5, lineHeight: 16 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  tokenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
  },
  tokenLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  tokenText: { fontSize: 20, fontWeight: '900', letterSpacing: 1.5, marginTop: 2 },
  tokenActions: { flexDirection: 'row', gap: 8 },
  smallIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  metricRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  metric: { flex: 1 },
  metricValue: { fontSize: 16, fontWeight: '900' },
  metricLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '800' },
  dangerBtn: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: { fontSize: 13, fontWeight: '800' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalCard: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1 },
  participantsCard: { maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalScroll: { padding: 18, gap: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 11, fontWeight: '800', marginBottom: 7, textTransform: 'uppercase' },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontWeight: '600' },
  formRow: { flexDirection: 'row', gap: 10 },
  tokenInputRow: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tokenInput: { flex: 1, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  allowedBox: { borderRadius: 13, borderWidth: 1, padding: 13 },
  allowedTitle: { fontSize: 13, fontWeight: '800' },
  allowedText: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  modalActions: { flexDirection: 'row', gap: 10, padding: 18, borderTopWidth: 1 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '800' },
  saveBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  participantsEmpty: { padding: 28, alignItems: 'center' },
  participantsList: { paddingHorizontal: 18, paddingBottom: 18 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1 },
  participantIndex: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  participantIndexText: { fontSize: 12, fontWeight: '900' },
  participantName: { fontSize: 14, fontWeight: '800' },
  participantMeta: { fontSize: 11, marginTop: 2, fontWeight: '600' },
});
