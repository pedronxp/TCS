import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { supabase } from '../../../utils/supabase';
import { upsertFormulariosCache, getFormulariosCache } from '../../../utils/database';
import { Card, Badge, EmptyState, LoadingState, ErrorState } from '../../../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Built-in JSON form catalog (mirrors formularios_list_screen.dart) ─────────
const FORMULARIOS_BUILTIN = [
  {
    id: 'vistoria_deslizamento_v2',
    titulo: 'Vistoria de Risco de Deslizamento',
    descricao: '10 questões · SVG por pergunta · Pontuação R1–R4',
    asset: require('../../../assets/formularios/vistoria_deslizamento_v2.json'),
    icon: 'trending-down' as const,
    isBuiltin: true,
    isNew: true,
  },
  {
    id: 'risco_estrutural_novo_v1',
    titulo: 'Avaliação de Risco Estrutural',
    descricao: '10 elementos · Inspeção técnica de edificações',
    asset: require('../../../assets/formularios/risco_estrutural_novo_v1.json'),
    icon: 'home' as const,
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
  const { isOnlineReal } = useConnectivity();
  const params = useLocalSearchParams<any>();
  const [dynamicForms, setDynamicForms] = useState<FormularioItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchDynamicForms();
  }, []);

  /** Busca formulários personalizados — online: Supabase + atualiza cache; offline: SQLite cache */
  const fetchDynamicForms = async () => {
    setFormError(null);
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
          descricao: `v${f.versao} • Publicado`,
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
            descricao: `v${f.versao} • Cache offline`,
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
            descricao: `v${f.versao} • Cache offline`,
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

    router.push({
      pathname: '/(panel)/inspecoes/wizard',
      params: {
        ...params,
        formularioId: form.id,
        formularioVersao: isBuiltin ? '1' : String((form as any).versao || 1),
        formularioTitulo: form.titulo,
        isBuiltin: isBuiltin ? 'true' : 'false',
      }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>PASSO 2 DE 3</Text>
          <Text style={[styles.title, { color: theme.text }]}>Tipo de Vistoria</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={[styles.progressTrack, { backgroundColor: theme.cardBorder }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.primary, width: '66%' }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Built-in forms */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          <Feather name="folder" size={12} /> MODELOS PADRÃO (OFFLINE)
        </Text>

        {FORMULARIOS_BUILTIN.map(f => {
          const sel = selected === f.id;
          return (
            <TouchableOpacity key={f.id} onPress={() => setSelected(f.id)}>
              <Card style={{ marginBottom: 12, borderWidth: sel ? 1.5 : 1, borderColor: sel ? theme.primary : theme.cardBorder }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: theme.iconBackground, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name={f.icon} size={22} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{f.titulo}</Text>
                    <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>{f.descricao}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <Badge label="Built-in" variant="success" />
                        {f.isNew && <Badge label="Novo" variant="info" />}
                      </View>
                      {sel
                        ? <Feather name="check-circle" size={16} color={theme.primary} />
                        : <Feather name="chevron-right" size={16} color={theme.muted} />
                      }
                    </View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}

        {/* Async states for custom forms */}
        {loading && <LoadingState />}
        {formError !== null && !loading && (
          <ErrorState message={formError} onRetry={fetchDynamicForms} />
        )}
        {!loading && !formError && dynamicForms.length === 0 && (
          <EmptyState
            icon="file-text"
            title="Nenhum formulário disponível"
            description="Aguarde a liberação de formulários pelo administrador."
          />
        )}

        {/* Supabase custom forms */}
        {!loading && !formError && dynamicForms.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 24 }]}>
              <Feather name={fromCache ? 'database' : 'cloud'} size={12} /> FORMULÁRIOS PERSONALIZADOS{fromCache ? ' (CACHE)' : ''}
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, justifyContent: 'space-between' }}>
                          <Badge label="Personalizado" variant="warning" />
                          {sel
                            ? <Feather name="check-circle" size={16} color={theme.primary} />
                            : <Feather name="chevron-right" size={16} color={theme.muted} />
                          }
                        </View>
                      </View>
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
        <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={() => router.back()}>
          <Text style={[styles.cancelText, { color: theme.textSecondary }]}>VOLTAR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: selected ? theme.primary : theme.cardBorder }]}
          onPress={avancar}
          disabled={!selected}
        >
          <Text style={styles.nextBtnText}>AVANÇAR</Text>
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
  footer: { padding: 20, paddingBottom: 36, borderTopWidth: 1, flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, height: 56, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  nextBtn: { flex: 2, height: 56, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  nextBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
