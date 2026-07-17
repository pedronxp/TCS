import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useTraining } from '../../../context/TrainingContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { supabase } from '../../../utils/supabase';
import { upsertFormulariosCache, getFormulariosCache } from '../../../utils/database';
import { Card, EmptyState, LoadingState, ErrorState } from '../../../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../../../context/SubscriptionContext';

// ─── Built-in JSON form catalog (mirrors formularios_list_screen.dart) ─────────
const FORMULARIOS_BUILTIN = [
  {
    id: 'avaliacao_arvore_cbmmg_v1',
    titulo: 'Risco em Árvore',
    descricao: 'Árvores ou galhos com risco de queda.',
    asset: require('../../../assets/formularios/avaliacao_arvore_cbmmg_v1.json'),
    icon: 'tree-outline' as const,
    iconColor: '#22C55E',
    featureCode: 'inspection_arv',
    isBuiltin: true,
  },
  {
    id: 'vistoria_deslizamento_v3',
    titulo: 'Risco de Deslizamento',
    descricao: 'Encostas, barrancos e movimentação do solo.',
    asset: require('../../../assets/formularios/vistoria_deslizamento_v3.json'),
    icon: 'image-filter-hdr' as const,
    iconColor: '#F59E0B',
    featureCode: 'inspection_standard',
    isBuiltin: true,
  },
  {
    id: 'risco_estrutural_novo_v2',
    titulo: 'Risco em Edificação',
    descricao: 'Rachaduras, danos e segurança do imóvel.',
    asset: require('../../../assets/formularios/risco_estrutural_novo_v2.json'),
    icon: 'home-city-outline' as const,
    iconColor: '#3B82F6',
    featureCode: 'inspection_standard',
    isBuiltin: true,
  },
];

interface FormularioItem {
  id: string;
  titulo: string;
  descricao?: string;
  versao?: number;
  status?: string;
  asset?: any;
  icon?: any;
  iconColor?: string;
  featureCode?: string;
  isBuiltin: boolean;
  isNew?: boolean;
}

const getFormIcon = (item: FormularioItem): string => {
  const nome = (item.titulo || '').toLowerCase();
  if (nome.includes('agua') || nome.includes('água') || nome.includes('enchente') || nome.includes('inundacao') || nome.includes('inundação')) return 'droplet';
  if (nome.includes('geo') || nome.includes('desliz') || nome.includes('talude')) return 'map-pin';
  if (nome.includes('estrutur') || nome.includes('constru')) return 'home';
  return 'file-text';
};

export default function SelecaoFormularioScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { isTrainingActive, session: trainingSession } = useTraining();
  const { isOnlineReal } = useConnectivity();
  const { hasFeature } = useSubscription();
  const params = useLocalSearchParams<any>();
  const [dynamicForms, setDynamicForms] = useState<FormularioItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const builtinForms = FORMULARIOS_BUILTIN.filter(f => !isTrainingActive || trainingSession?.allowedForms.includes(f.id));
  const hasAvailableForms = builtinForms.length + dynamicForms.length > 0;

  const voltar = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(isTrainingActive ? '/(panel)/treinamento' : '/(panel)/inspecoes/dados-iniciais');
  };

  useEffect(() => {
    fetchDynamicForms();
  }, []);

  /** Busca formulários personalizados — online: Supabase + atualiza cache; offline: SQLite cache */
  const fetchDynamicForms = async () => {
    setFormError(null);
    if (isTrainingActive) {
      setDynamicForms([]);
      setFromCache(false);
      setLoading(false);
      return;
    }
    try {
      if (isOnlineReal) {
        const { data } = await supabase
          .from('formularios')
          .select('id, titulo, descricao, versao, status, perguntas, classificacao, fases, tipoCalculo, municipio, atualizadoEm')
          .eq('ativo', true)
          .order('atualizadoEm', { ascending: false });

        if (data && data.length > 0) {
          // Persiste no cache SQLite para uso offline futuro — inclui payload completo
          // para que o wizard possa carregar classificacao, fases e tipoCalculo offline.
          upsertFormulariosCache(data.map(f => ({
            id: f.id,
            titulo: f.titulo,
            descricao: f.descricao ?? null,
            versao: f.versao,
            status: f.status,
            perguntas_json: JSON.stringify(f.perguntas || []),
            municipio: f.municipio ?? null,
            atualizado_em: f.atualizadoEm || new Date().toISOString(),
            classificacao_json: f.classificacao ? JSON.stringify(f.classificacao) : null,
            fases_json: f.fases ? JSON.stringify(f.fases) : null,
            tipo_calculo: (f as any).tipoCalculo ?? null,
          })));
        }

        const customs: FormularioItem[] = (data || []).map(f => ({
          id: f.id,
          titulo: f.titulo,
          descricao: 'Modelo criado pela sua equipe.',
          versao: f.versao,
          status: f.status,
          isBuiltin: false,
        }));
        setDynamicForms(customs);
        setFromCache(false);
      } else {
        // Offline — usa cache SQLite
        const cached = getFormulariosCache(profile?.municipio || undefined);
        const customs: FormularioItem[] = cached
          .filter(f => f.status === 'publicado')
          .map(f => ({
            id: f.id,
            titulo: f.titulo,
            descricao: 'Modelo criado pela sua equipe.',
            versao: f.versao,
            status: f.status,
            isBuiltin: false,
          }));
        setDynamicForms(customs);
        setFromCache(customs.length > 0);
      }
    } catch (e) {
      setFormError('Erro ao carregar formulários.');
      // Fallback to cache on any error
      try {
        const cached = getFormulariosCache(profile?.municipio || undefined);
        const customs: FormularioItem[] = cached
          .filter(f => f.status === 'publicado')
          .map(f => ({
            id: f.id,
            titulo: f.titulo,
            descricao: 'Modelo criado pela sua equipe.',
            versao: f.versao,
            status: f.status,
            isBuiltin: false,
          }));
        setDynamicForms(customs);
        setFromCache(customs.length > 0);
      } catch {
        // silently ignore — built-in forms still available
      }
    } finally {
      setLoading(false);
    }
  };

  const avancar = () => {
    if (!selected) {
      Alert.alert('Selecione um tipo', 'Escolha um formulário para continuar.');
      return;
    }

    // Find in both lists
    const builtin = FORMULARIOS_BUILTIN.find(f => f.id === selected);
    const isBuiltin = !!builtin;
    const form = builtin || dynamicForms.find(f => f.id === selected)!;
    const normalizedTitle = form.titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const featureCode = form.featureCode || (normalizedTitle.includes('arv') || normalizedTitle.includes('arvore')
      ? 'inspection_arv'
      : 'inspection_standard');
    if (!isTrainingActive && !hasFeature(featureCode)) {
      Alert.alert('Recurso não incluído', 'Este modelo não está disponível no plano atual.', [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Ver assinatura', onPress: () => router.push('/(panel)/assinatura') },
      ]);
      return;
    }

    router.push({
      pathname: '/(panel)/inspecoes/wizard',
      params: {
        ...params,
        formularioId: form.id,
        formularioVersao: isBuiltin ? String((form as any).asset?.versao || 1) : String((form as any).versao || 1),
        formularioTitulo: form.titulo,
        isBuiltin: isBuiltin ? 'true' : 'false',
      }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]} onPress={voltar}>
          <Feather name="arrow-left" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>PASSO 2 DE 3</Text>
          <Text style={[styles.title, { color: theme.text }]}>Escolha a Vistoria</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={[styles.progressTrack, { backgroundColor: theme.cardBorder }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.primary, width: '66%' }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Built-in forms */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          <Feather name="clipboard" size={12} /> {isTrainingActive ? 'ESCOLHA A ATIVIDADE' : 'ESCOLHA O TIPO DE VISTORIA'}
        </Text>
        {!isTrainingActive && (
          <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>Todos os tipos abaixo funcionam sem internet.</Text>
        )}

        {builtinForms.map(f => {
          const sel = selected === f.id;
          return (
            <TouchableOpacity key={f.id} onPress={() => setSelected(f.id)}>
              <Card style={{ marginBottom: 12, borderWidth: sel ? 1.5 : 1, borderColor: sel ? theme.primary : theme.cardBorder }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: `${f.iconColor}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name={f.icon as any} size={27} color={f.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{f.titulo}</Text>
                    <Text style={{ fontSize: 13, lineHeight: 18, color: theme.textSecondary, marginTop: 4 }}>{f.descricao}</Text>
                  </View>
                  {sel
                    ? <Feather name="check-circle" size={21} color={theme.primary} />
                    : <Feather name="circle" size={21} color={theme.muted} />
                  }
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}

        {/* Async states for custom forms */}
        {loading && !isTrainingActive && <LoadingState />}
        {formError !== null && !loading && (
          <ErrorState message={formError} onRetry={fetchDynamicForms} />
        )}
        {!loading && !formError && !hasAvailableForms && (
          <EmptyState
            icon="file-text"
            title={isTrainingActive ? 'Nenhum formulário liberado' : 'Nenhum formulário disponível'}
            description={isTrainingActive ? 'Esta turma ainda não possui modelos de aula ativos.' : 'Aguarde a liberação de formulários pelo administrador.'}
          />
        )}

        {/* Supabase custom forms */}
        {!loading && !formError && dynamicForms.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 24 }]}>
              <Feather name="users" size={12} /> MODELOS DA SUA EQUIPE
            </Text>
            {dynamicForms.map(f => {
              const sel = selected === f.id;
              return (
                <TouchableOpacity key={f.id} onPress={() => setSelected(f.id)}>
                  <Card style={{ marginBottom: 12, borderWidth: sel ? 1.5 : 1, borderColor: sel ? theme.primary : theme.cardBorder }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: theme.iconBackground, alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name={getFormIcon(f) as any} size={22} color={theme.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{f.titulo}</Text>
                        <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>{f.descricao || ''}</Text>
                        <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 7 }}>Disponível para sua equipe</Text>
                      </View>
                      {sel
                        ? <Feather name="check-circle" size={21} color={theme.primary} />
                        : <Feather name="circle" size={21} color={theme.muted} />
                      }
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: theme.surfaceHighlight, borderTopColor: theme.border }]}>
        <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={voltar}>
          <Text style={[styles.cancelText, { color: theme.textSecondary }]}>VOLTAR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: selected ? theme.primary : theme.cardBorder }]}
          onPress={avancar}
          disabled={!selected}
        >
          <Text style={styles.nextBtnText}>CONTINUAR</Text>
          <Feather name="arrow-right" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  stepLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  scroll: { padding: 20, paddingBottom: 120 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  sectionHint: { fontSize: 12, lineHeight: 17, marginTop: -5, marginBottom: 14 },
  footer: { padding: 20, paddingBottom: 36, borderTopWidth: 1, flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, height: 56, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  nextBtn: { flex: 2, height: 56, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  nextBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
