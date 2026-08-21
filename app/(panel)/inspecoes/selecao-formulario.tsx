import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useTraining } from '../../../context/TrainingContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { supabase } from '../../../utils/supabase';
import { getInactiveSystemFormCodes, getFormulariosCache, replaceSystemFormCatalog, upsertFormulariosCache } from '../../../utils/database';
import {
  AppHeader,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FlowProgress,
  LoadingState,
  SectionHeader,
  StateBanner,
} from '../../../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '../../../context/SubscriptionContext';
import { FontSize, FontWeight } from '../../../constants/Typography';
import { Spacing, SpacingAlias } from '../../../constants/Spacing';

function colorWithAlpha(color: string, alpha: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? `${color}${alpha}` : color;
}

// ─── Built-in JSON form catalog (mirrors formularios_list_screen.dart) ─────────
const FORMULARIOS_BUILTIN = [
  {
    id: 'risco_inundacao_v1',
    titulo: 'Risco de Inundação e Alagamento',
    descricao: 'Água acumulada, enxurrada, erosão e áreas atingidas.',
    asset: require('../../../assets/formularios/risco_inundacao_v1.json'),
    icon: 'water-alert' as const,
    iconColor: '#0EA5E9',
    featureCode: 'inspection_standard',
    isBuiltin: true,
  },
  {
    id: 'risco_incendio_vegetacao_v1',
    titulo: 'Risco de Incêndio em Vegetação',
    descricao: 'Vegetação seca, fumaça, fogo e propagação para áreas ocupadas.',
    asset: require('../../../assets/formularios/risco_incendio_vegetacao_v1.json'),
    icon: 'fire-alert' as const,
    iconColor: '#EF4444',
    featureCode: 'inspection_standard',
    isBuiltin: true,
  },
  {
    id: 'inspecao_ponte_passarela_v1',
    titulo: 'Inspeção de Ponte e Passarela',
    descricao: 'Danos visíveis, fundações, erosão e segurança de uso.',
    asset: require('../../../assets/formularios/inspecao_ponte_passarela_v1.json'),
    icon: 'bridge' as const,
    iconColor: '#8B5CF6',
    featureCode: 'inspection_standard',
    isBuiltin: true,
  },
  {
    id: 'inspecao_bueiro_drenagem_v1',
    titulo: 'Inspeção de Bueiro e Drenagem',
    descricao: 'Obstrução, transbordamento, erosão e danos em vias.',
    asset: require('../../../assets/formularios/inspecao_bueiro_drenagem_v1.json'),
    icon: 'pipe-leak' as const,
    iconColor: '#14B8A6',
    featureCode: 'inspection_standard',
    isBuiltin: true,
  },
  {
    id: 'avaliacao_arvore_cbmmg_v1',
    titulo: 'Risco em Árvore',
    descricao: 'Árvores ou galhos com risco de queda.',
    asset: require('../../../assets/formularios/avaliacao_arvore_cbmmg_v1.json'),
    icon: 'tree-outline' as const,
    featureCode: 'inspection_arv',
    isBuiltin: true,
  },
  {
    id: 'vistoria_deslizamento_v3',
    titulo: 'Risco de Deslizamento',
    descricao: 'Encostas, barrancos e movimentação do solo.',
    asset: require('../../../assets/formularios/vistoria_deslizamento_v3.json'),
    icon: 'image-filter-hdr' as const,
    featureCode: 'inspection_standard',
    isBuiltin: true,
  },
  {
    id: 'risco_estrutural_novo_v2',
    titulo: 'Risco em Edificação',
    descricao: 'Rachaduras, danos e segurança do imóvel.',
    asset: require('../../../assets/formularios/risco_estrutural_novo_v2.json'),
    icon: 'home-city-outline' as const,
    featureCode: 'inspection_standard',
    isBuiltin: true,
  },
];

interface FormularioItem {
  id: string;
  systemCode?: string | null;
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
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { isTrainingActive, session: trainingSession } = useTraining();
  const { isOnlineReal } = useConnectivity();
  const { hasFeature } = useSubscription();
  const params = useLocalSearchParams<any>();
  const [dynamicForms, setDynamicForms] = useState<FormularioItem[]>([]);
  const [disabledSystemCodes, setDisabledSystemCodes] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Online, a versão publicada no servidor substitui o mesmo formulário nativo.
  // Offline, o JSON embarcado continua disponível como contingência.
  const builtinForms = FORMULARIOS_BUILTIN.filter((form) => (
    (!isTrainingActive || trainingSession?.allowedForms.includes(form.id))
    && !dynamicForms.some((remote) => remote.systemCode === form.id)
    && !disabledSystemCodes.includes(form.id)
  ));
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
        const [{ data, error }, { data: catalog, error: catalogError }] = await Promise.all([
          supabase
          .from('formularios')
          .select('id, codigoSistema, titulo, descricao, versao, status, perguntas, classificacao, fases, tipoCalculo, municipio, atualizadoEm')
          .eq('ativo', true)
          .eq('status', 'publicado')
          .order('atualizadoEm', { ascending: false }),
          supabase.rpc('list_mobile_form_catalog'),
        ]);
        if (error) throw error;
        if (catalogError) throw catalogError;

        const catalogItems = Array.isArray(catalog) ? catalog as Array<{ codigo_sistema?: string; ativo?: boolean; atualizado_em?: string }> : [];
        const disabled = catalogItems
          .filter((item) => item.codigo_sistema && item.ativo === false)
          .map((item) => item.codigo_sistema as string);
        replaceSystemFormCatalog(catalogItems
          .filter((item) => item.codigo_sistema)
          .map((item) => ({ codigoSistema: item.codigo_sistema as string, ativo: item.ativo !== false, atualizadoEm: item.atualizado_em || new Date().toISOString() })));
        setDisabledSystemCodes(disabled);

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
          systemCode: (f as any).codigoSistema ?? null,
          titulo: f.titulo,
          descricao: f.descricao || 'Modelo publicado pela sua equipe.',
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
        setDisabledSystemCodes(getInactiveSystemFormCodes());
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
        setDisabledSystemCodes(getInactiveSystemFormCodes());
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
      <AppHeader
        title="Tipo de vistoria"
        subtitle="Nova vistoria"
        onBack={voltar}
        style={{ paddingTop: insets.top + Spacing[2], minHeight: insets.top + 72 }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <FlowProgress currentStep={2} totalSteps={3} label="Modelo técnico" />

        {!isTrainingActive && (
          <StateBanner
            variant="info"
            title="Disponível também offline"
            description="Os modelos técnicos do TCS permanecem acessíveis mesmo sem conexão."
          />
        )}

        <SectionHeader
          title={isTrainingActive ? 'Escolha a atividade' : 'Modelos técnicos TCS'}
          subtitle="Selecione o modelo adequado ao tipo de ocorrência"
        />

        {builtinForms.map(f => {
          const sel = selected === f.id;
          const accent = f.iconColor || theme.primary;
          const iconBackground = colorWithAlpha(accent, isDark ? (sel ? '36' : '20') : (sel ? '24' : '14'));
          return (
            <Pressable key={f.id} onPress={() => setSelected(f.id)} accessibilityRole="radio" accessibilityState={{ checked: sel }}>
              <Card style={{ ...styles.formCard, borderColor: sel ? accent : theme.cardBorder, backgroundColor: sel ? colorWithAlpha(accent, isDark ? '14' : '0A') : theme.surface }}>
                <View style={styles.formRow}>
                  <View style={[styles.formIcon, { backgroundColor: iconBackground }]}>
                    <MaterialCommunityIcons name={f.icon as any} size={25} color={accent} />
                  </View>
                  <View style={styles.formCopy}>
                    <Text style={[styles.formTitle, { color: theme.text }]}>{f.titulo}</Text>
                    <Text style={[styles.formDescription, { color: theme.textSecondary }]}>{f.descricao}</Text>
                  </View>
                  {sel
                    ? <View style={[styles.selectedMark, { backgroundColor: accent }]}><Feather name="check" size={16} color={theme.onPrimary} /></View>
                    : <View style={[styles.unselectedMark, { borderColor: theme.border }]} />
                  }
                </View>
              </Card>
            </Pressable>
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
            <SectionHeader title="Modelos da sua equipe" subtitle="Formulários publicados para esta operação" />
            {dynamicForms.map(f => {
              const sel = selected === f.id;
              return (
                <Pressable key={f.id} onPress={() => setSelected(f.id)} accessibilityRole="radio" accessibilityState={{ checked: sel }}>
                  <Card style={{ ...styles.formCard, borderColor: sel ? theme.primary : theme.cardBorder, backgroundColor: sel ? theme.secondary : theme.surface }}>
                    <View style={styles.formRow}>
                      <View style={[styles.formIcon, { backgroundColor: sel ? theme.primary : theme.secondary }]}>
                        <Feather name={getFormIcon(f) as any} size={22} color={sel ? theme.onPrimary : theme.primary} />
                      </View>
                      <View style={styles.formCopy}>
                        <Text style={[styles.formTitle, { color: theme.text }]}>{f.titulo}</Text>
                        <Text style={[styles.formDescription, { color: theme.textSecondary }]}>{f.descricao || 'Modelo técnico personalizado'}</Text>
                        <Text style={[styles.teamLabel, { color: theme.primary }]}>Disponível para sua equipe</Text>
                      </View>
                      {sel
                        ? <View style={[styles.selectedMark, { backgroundColor: theme.primary }]}><Feather name="check" size={16} color={theme.onPrimary} /></View>
                        : <View style={[styles.unselectedMark, { borderColor: theme.border }]} />
                      }
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
        <Button label="Voltar" variant="ghost" onPress={voltar} style={styles.backButton} />
        <Button
          label="Iniciar avaliação"
          onPress={avancar}
          disabled={!selected}
          iconRight={<Feather name="arrow-right" size={18} color={theme.onPrimary} />}
          style={styles.nextButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing[4], paddingBottom: Spacing[8], gap: Spacing[4] },
  formCard: { marginBottom: Spacing[3], borderWidth: 1.5 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  formIcon: {
    width: 52,
    height: 52,
    borderRadius: SpacingAlias.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCopy: { flex: 1, minWidth: 0 },
  formTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  formDescription: { marginTop: Spacing[1], fontSize: FontSize.sm, lineHeight: 18 },
  teamLabel: { marginTop: Spacing[2], fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  selectedMark: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  unselectedMark: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5 },
  footer: { padding: Spacing[4], borderTopWidth: 1, flexDirection: 'row', gap: Spacing[2] },
  backButton: { flex: 1 },
  nextButton: { flex: 2 },
});
