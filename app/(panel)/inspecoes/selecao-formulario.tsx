import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { supabase } from '../../../utils/supabase';
import { upsertFormulariosCache, getFormulariosCache } from '../../../utils/database';

// ─── Built-in JSON form catalog (mirrors formularios_list_screen.dart) ─────────
const FORMULARIOS_BUILTIN = [
  {
    id: 'estrutural_v1',
    titulo: 'Vistoria Estrutural',
    descricao: '7 fases • Soma total de risco',
    asset: require('../../../assets/formularios/estrutural.json'),
    icon: 'layers' as const,
    isBuiltin: true,
  },
  {
    id: 'deslizamento_campo_v1',
    titulo: 'Deslizamento Técnico',
    descricao: '10 fases • Planilha técnica de campo',
    asset: require('../../../assets/formularios/deslizamento_campo.json'),
    icon: 'trending-down' as const,
    isBuiltin: true,
  },
  {
    id: 'estrutural_avancado_v1',
    titulo: 'Estrutural Completo',
    descricao: '12 sistemas • Avaliação aprofundada',
    asset: require('../../../assets/formularios/estrutural_avancado.json'),
    icon: 'home' as const,
    isBuiltin: true,
  },
  {
    id: 'inundacao_v1',
    titulo: 'Vistoria de Inundação',
    descricao: '8 fases • Enchente e alagamento',
    asset: require('../../../assets/formularios/inundacao.json'),
    icon: 'droplet' as const,
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
}

export default function SelecaoFormularioScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { isOnlineReal } = useConnectivity();
  const params = useLocalSearchParams<any>();
  const [dynamicForms, setDynamicForms] = useState<FormularioItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    fetchDynamicForms();
  }, []);

  /** Busca formulários personalizados — online: Supabase + atualiza cache; offline: SQLite cache */
  const fetchDynamicForms = async () => {
    try {
      if (isOnlineReal) {
        const { data } = await supabase
          .from('formularios')
          .select('id, titulo, descricao, versao, status, perguntas, municipio, atualizadoEm')
          .eq('ativo', true)
          .order('atualizadoEm', { ascending: false });

        if (data && data.length > 0) {
          // Persiste no cache SQLite para uso offline futuro
          upsertFormulariosCache(data.map(f => ({
            id: f.id,
            titulo: f.titulo,
            descricao: f.descricao ?? null,
            versao: f.versao,
            status: f.status,
            perguntas_json: JSON.stringify(f.perguntas || []),
            municipio: f.municipio ?? null,
            atualizado_em: f.atualizadoEm || new Date().toISOString(),
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

  // ─── All forms: built-in first, then Supabase custom ──────────────────────
  const allForms: FormularioItem[] = [
    ...FORMULARIOS_BUILTIN,
    ...dynamicForms,
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
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
            <TouchableOpacity
              key={f.id}
              style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: sel ? theme.primary : theme.cardBorder }]}
              onPress={() => setSelected(f.id)}
            >
              <View style={[styles.iconBadge, { backgroundColor: theme.iconBackground }]}>
                <Feather name={f.icon} size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{f.titulo}</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{f.descricao}</Text>
              </View>
              {sel && <Feather name="check-circle" size={22} color={theme.primary} />}
            </TouchableOpacity>
          );
        })}

        {/* Supabase custom forms */}
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 16 }} />
        ) : dynamicForms.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 24 }]}>
              <Feather name={fromCache ? 'database' : 'cloud'} size={12} /> FORMULÁRIOS PERSONALIZADOS{fromCache ? ' (CACHE)' : ''}
            </Text>
            {dynamicForms.map(f => {
              const sel = selected === f.id;
              const isPublished = f.status === 'publicado';
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: sel ? theme.primary : theme.cardBorder }]}
                  onPress={() => setSelected(f.id)}
                >
                  <View style={[styles.iconBadge, { backgroundColor: isPublished ? 'rgba(16,185,129,0.1)' : theme.iconBackground }]}>
                    <Feather name="file-text" size={22} color={isPublished ? '#10B981' : theme.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{f.titulo}</Text>
                    <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{f.descricao}</Text>
                  </View>
                  {sel && <Feather name="check-circle" size={22} color={theme.primary} />}
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}
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
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  stepLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  scroll: { padding: 20, paddingBottom: 120 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  card: { borderRadius: 14, borderWidth: 1.5, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  iconBadge: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSub: { fontSize: 12, marginTop: 2 },
  footer: { padding: 20, paddingBottom: 36, borderTopWidth: 1, flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, height: 56, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  nextBtn: { flex: 2, height: 56, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  nextBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
