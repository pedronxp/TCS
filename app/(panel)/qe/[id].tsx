import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, Badge, Button, FormField, LoadingState, ErrorState, StateBanner } from '../../../components/ui';

const CHECKLIST_PADRAO = [
  'Fotos legíveis e suficientes',
  'Campos preenchidos de forma coerente',
  'Endereço/localização corretos',
  'Classificação de risco condizente com as respostas',
  'Ciência coletada do responsável',
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

  const tudoOk = checklist.every(Boolean);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title={`Revisão · ciclo ${revisao.ciclo}`}
          subtitle={vistoria.agenteNome ?? 'Agente'}
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        {/* Resumo da vistoria */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{vistoria.endereco ?? 'Endereço não informado'}</Text>
          <View style={styles.resumoLinha}>
            <Badge label={`Risco ${vistoria.nivelRisco ?? '—'}`.toUpperCase()} variant="info" size="sm" />
            <Text style={[styles.metaTexto, { color: theme.textSecondary }]}>
              {vistoria.pontuacaoTotal != null ? `${vistoria.pontuacaoTotal} pts` : ''}
              {vistoria.dataVistoria ? ` · ${new Date(vistoria.dataVistoria).toLocaleDateString('pt-BR')}` : ''}
            </Text>
          </View>
        </View>

        {/* Fotos */}
        {vistoria.fotosUrls && vistoria.fotosUrls.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {vistoria.fotosUrls.map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.foto} accessibilityLabel={`Foto ${i + 1} da vistoria`} />
            ))}
          </ScrollView>
        ) : null}

        {/* Checklist */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Checklist de qualidade</Text>
          {CHECKLIST_PADRAO.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.checkItem}
              onPress={() => setChecklist(prev => prev.map((v, j) => (j === i ? !v : v)))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: checklist[i] }}
              accessibilityLabel={item}
            >
              <View style={[styles.checkbox, { borderColor: theme.border, backgroundColor: checklist[i] ? theme.success : 'transparent' }]}>
                {checklist[i] ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
              </View>
              <Text style={[styles.checkTexto, { color: theme.text }]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Nota */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Nota da vistoria</Text>
          <View style={styles.notaLinha}>
            <TouchableOpacity onPress={() => setNota(n => Math.max(0, n - 1))} style={[styles.notaBtn, { borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel="Diminuir nota">
              <Feather name="minus" size={18} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.notaValor, { color: theme.primary }]}>{nota}</Text>
            <TouchableOpacity onPress={() => setNota(n => Math.min(10, n + 1))} style={[styles.notaBtn, { borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel="Aumentar nota">
              <Feather name="plus" size={18} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.notaDe, { color: theme.textSecondary }]}>/ 10</Text>
          </View>
        </View>

        {/* Parecer */}
        <FormField
          label="Parecer (obrigatório ao devolver)"
          value={parecer}
          onChangeText={setParecer}
          placeholder="Descreva o que precisa ser corrigido ou observações da revisão."
          multiline
          inputStyle={{ minHeight: 90, textAlignVertical: 'top' }}
        />

        {tudoOk ? null : (
          <StateBanner
            variant="warning"
            title="Checklist incompleto"
            description="Itens não marcados sugerem devolução com parecer em vez de aprovação."
          />
        )}

        <View style={{ gap: 10 }}>
          <Button
            label="Aprovar vistoria"
            loading={salvando === 'aprovar'}
            onPress={() => void finalizar(true)}
            fullWidth
            iconLeft={<Feather name="check-circle" size={18} color="#FFFFFF" />}
          />
          <Button
            label="Devolver para correção"
            variant="secondary"
            loading={salvando === 'devolver'}
            onPress={() => void finalizar(false)}
            fullWidth
            iconLeft={<Feather name="rotate-ccw" size={18} color={theme.primary} />}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  resumoLinha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaTexto: { fontSize: 12 },
  foto: { width: 120, height: 120, borderRadius: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkTexto: { flex: 1, fontSize: 13 },
  notaLinha: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  notaBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notaValor: { fontSize: 30, fontWeight: '800', minWidth: 44, textAlign: 'center' },
  notaDe: { fontSize: 13 },
});
