import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, Badge, ErrorState, FormField, LoadingState, OptionSheet, StateBanner } from '../../../components/ui';

const CHECKLIST_PADRAO = [
  'Fotos legíveis e suficientes',
  'Campos preenchidos de forma coerente',
  'Endereço/localização corretos',
  'Classificação de risco condizente com as respostas',
  'Ciência coletada do responsável',
];

const NOTAS_LABELS = [
  '0 — Falhas graves',
  '1 — Muito fraca',
  '2 — Fraca',
  '3 — Insuficiente',
  '4 — Regular, precisa melhorar',
  '5 — Razoável',
  '6 — Acima da média',
  '7 — Boa, com ressalvas',
  '8 — Boa',
  '9 — Muito boa',
  '10 — Excelente',
];

interface VistoriaDetalhe {
  id: string;
  agenteNome: string | null;
  endereco: string | null;
  nivelRisco: string | null;
  pontuacaoTotal: number | null;
  dataVistoria: string | null;
  fotosUrls: string[] | null;
  respostasJson: any;
}

interface Revisao {
  id: string;
  vistoria_id: string;
  ciclo: number;
  status: string;
}

export default function QeRevisarScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [revisao, setRevisao] = useState<Revisao | null>(null);
  const [vistoria, setVistoria] = useState<VistoriaDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<boolean[]>(CHECKLIST_PADRAO.map(() => false));
  const [nota, setNota] = useState<number>(7);
  const [parecer, setParecer] = useState('');
  const [salvando, setSalvando] = useState<'aprovar' | 'devolver' | null>(null);
  const [notaSheetVisible, setNotaSheetVisible] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data: rev, error: revErr } = await supabase
        .from('revisoes_qe')
        .select('id, vistoria_id, ciclo, status')
        .eq('id', id)
        .single();
      if (revErr) throw revErr;

      const { data: v, error: vErr } = await supabase
        .from('vistorias')
        .select('id, "agenteNome", endereco, "nivelRisco", "pontuacaoTotal", "dataVistoria", "fotosUrls", "respostasJson"')
        .eq('id', rev.vistoria_id)
        .single();
      if (vErr) throw vErr;

      setRevisao(rev as Revisao);
      setVistoria(v as VistoriaDetalhe);
    } catch {
      setErro('Não foi possível carregar a vistoria para revisão.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  const finalizar = async (aprovado: boolean) => {
    if (!revisao) return;
    if (!aprovado && parecer.trim().length < 5) {
      Alert.alert('Parecer obrigatório', 'Ao devolver, descreva o que precisa ser corrigido.');
      return;
    }
    setSalvando(aprovado ? 'aprovar' : 'devolver');
    try {
      const { error } = await supabase.rpc('qe_revisar', {
        p_revisao_id: revisao.id,
        p_nota: nota,
        p_checklist: CHECKLIST_PADRAO.map((item, i) => ({ item, ok: checklist[i] })),
        p_parecer: parecer.trim() || null,
        p_aprovado: aprovado,
      });
      if (error) throw error;
      Alert.alert(
        aprovado ? 'Vistoria aprovada' : 'Vistoria devolvida',
        aprovado ? 'A vistoria foi aprovada na revisão de qualidade.' : 'O agente será notificado para corrigir e reenviar.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível registrar a revisão.');
    } finally {
      setSalvando(null);
    }
  };

  if (loading) return <LoadingState message="Abrindo revisão..." />;
  if (erro || !revisao || !vistoria) return <ErrorState message={erro ?? 'Revisão não encontrada.'} onRetry={() => void carregar()} />;

  const marcados = checklist.filter(Boolean).length;
  const tudoOk = checklist.every(Boolean);
  const nivel = (vistoria.nivelRisco ?? 'r1').toUpperCase() as 'R1' | 'R2' | 'R3' | 'R4';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Revisar vistoria"
          subtitle={`Ciclo ${revisao.ciclo}${vistoria.dataVistoria ? ` · ${new Date(vistoria.dataVistoria).toLocaleDateString('pt-BR')}` : ''}`}
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        {/* Resumo */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Resumo</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.resumoRow}>
            <View style={styles.resumoLeft}>
              <Text style={[styles.resumoNome, { color: theme.text }]}>{vistoria.agenteNome ?? 'Agente'}</Text>
              <Text style={[styles.resumoEndereco, { color: theme.textSecondary }]} numberOfLines={2}>
                {vistoria.endereco ?? 'Endereço não informado'}
              </Text>
            </View>
            <View style={styles.resumoRight}>
              <Badge label={nivel} variant={nivel} showDot size="sm" />
              <Text style={[styles.resumoPts, { color: theme.textSecondary }]}>
                {vistoria.pontuacaoTotal != null ? `${vistoria.pontuacaoTotal} pts` : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Evidências */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          Evidências{vistoria.fotosUrls?.length ? ` (${vistoria.fotosUrls.length})` : ''}
        </Text>
        {vistoria.fotosUrls && vistoria.fotosUrls.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fotosStrip}>
            {vistoria.fotosUrls.map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.foto} accessibilityLabel={`Foto ${i + 1} da vistoria`} />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Nenhuma foto registrada nesta vistoria.</Text>
          </View>
        )}

        {/* Checklist */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Checklist</Text>
        <View style={[styles.checklistCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.checklistHead, { borderBottomColor: theme.border }]}>
            <Text style={[styles.checklistHeadTitle, { color: theme.text }]}>Critérios de conferência</Text>
            <Text style={[styles.checklistHeadCount, { color: theme.textSecondary }]}>{marcados}/{CHECKLIST_PADRAO.length}</Text>
          </View>
          {CHECKLIST_PADRAO.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.checkItem, i < CHECKLIST_PADRAO.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
              onPress={() => setChecklist(prev => prev.map((v, j) => (j === i ? !v : v)))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: checklist[i] }}
              accessibilityLabel={item}
            >
              <View style={[styles.checkbox, { borderColor: checklist[i] ? theme.primary : theme.border, backgroundColor: checklist[i] ? theme.primary : 'transparent' }]}>
                {checklist[i] ? <Feather name="check" size={13} color={theme.onPrimary} /> : null}
              </View>
              <Text style={[styles.checkTexto, { color: checklist[i] ? theme.text : theme.textSecondary }]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Avaliação */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Avaliação</Text>
        <View style={styles.avaliacaoGroup}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Nota de qualidade</Text>
          <TouchableOpacity
            style={[styles.notaDropdown, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setNotaSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`Nota atual ${nota} de 10`}
          >
            <Text style={[styles.notaDropdownText, { color: theme.text }]}>{NOTAS_LABELS[nota]}</Text>
            <Feather name="chevron-down" size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          <FormField
            label="Parecer técnico (obrigatório ao devolver)"
            value={parecer}
            onChangeText={setParecer}
            placeholder="Escreva o parecer da revisão."
            multiline
            inputStyle={{ minHeight: 90, textAlignVertical: 'top' }}
          />
        </View>

        {tudoOk ? null : (
          <StateBanner
            variant="warning"
            title="Checklist incompleto"
            description="Itens não marcados sugerem devolução com parecer em vez de aprovação."
          />
        )}

        {/* Ações */}
        <View style={styles.acoesRow}>
          <TouchableOpacity
            style={[styles.acaoBtn, styles.acaoDevolver, { borderColor: theme.error }]}
            onPress={() => void finalizar(false)}
            disabled={salvando !== null}
            accessibilityRole="button"
          >
            {salvando === 'devolver'
              ? <ActivityIndicator size="small" color={theme.error} />
              : <Feather name="rotate-ccw" size={16} color={theme.error} />}
            <Text style={[styles.acaoDevolverText, { color: theme.error }]}>Devolver</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acaoBtn, { backgroundColor: theme.primary }]}
            onPress={() => void finalizar(true)}
            disabled={salvando !== null}
            accessibilityRole="button"
          >
            {salvando === 'aprovar'
              ? <ActivityIndicator size="small" color={theme.onPrimary} />
              : <Feather name="check" size={16} color={theme.onPrimary} />}
            <Text style={[styles.acaoAprovarText, { color: theme.onPrimary }]}>Aprovar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Nota 0–10 como dropdown (muitas opções) */}
      <OptionSheet
        visible={notaSheetVisible}
        title="Nota de qualidade"
        description="Zero é vistoria com falhas graves; dez é impecável."
        options={NOTAS_LABELS.map((texto, valor) => ({
          key: String(valor),
          title: texto,
          selected: nota === valor,
        }))}
        onSelect={key => {
          setNota(Number(key));
          setNotaSheetVisible(false);
        }}
        onDismiss={() => setNotaSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: 12, gap: 4 },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 14, marginBottom: 8, marginLeft: 2,
  },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  resumoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resumoLeft: { flex: 1, minWidth: 0 },
  resumoNome: { fontSize: 15, fontWeight: '800' },
  resumoEndereco: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  resumoRight: { alignItems: 'flex-end', gap: 5 },
  resumoPts: { fontSize: 11.5, fontWeight: '700' },
  fotosStrip: { gap: 10, paddingRight: 4 },
  foto: { width: 110, height: 84, borderRadius: 12 },
  checklistCard: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  checklistHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1,
  },
  checklistHeadTitle: { fontSize: 13, fontWeight: '800' },
  checklistHeadCount: { fontSize: 12, fontWeight: '800' },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, paddingVertical: 12 },
  checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 1.6, alignItems: 'center', justifyContent: 'center' },
  checkTexto: { flex: 1, fontSize: 13, lineHeight: 18 },
  avaliacaoGroup: { gap: 4 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  notaDropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, minHeight: 50, marginBottom: 10,
  },
  notaDropdownText: { fontSize: 14, fontWeight: '700' },
  acoesRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  acaoBtn: {
    flex: 1, minHeight: 50, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  acaoDevolver: { borderWidth: 1.5, backgroundColor: 'transparent' },
  acaoDevolverText: { fontSize: 14, fontWeight: '800' },
  acaoAprovarText: { fontSize: 14, fontWeight: '800' },
});
