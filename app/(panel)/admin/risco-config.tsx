import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, Badge, Button, ConfirmSheet, FormField, StateBanner } from '../../../components/ui';

const STORAGE_KEY = '@risco_config_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_CONFIG = [
  { nivel: 'r1', label: 'Baixo Risco', cor: '#2E7D5A', descricao: 'Monitoramento preventivo', minPontos: 0, maxPontos: 24 },
  { nivel: 'r2', label: 'Risco Médio', cor: '#A66B22', descricao: 'Vistoria técnica necessária', minPontos: 25, maxPontos: 49 },
  { nivel: 'r3', label: 'Risco Alto', cor: '#C45F2A', descricao: 'Laudo de engenheiro obrigatório', minPontos: 50, maxPontos: 74 },
  { nivel: 'r4', label: 'Risco Crítico', cor: '#B24A4A', descricao: 'Recomendar interdição imediata', minPontos: 75, maxPontos: 9999 },
];

export default function RiscoConfigScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [editMode, setEditMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'local' | 'cloud' | null>(null);
  const [resetVisible, setResetVisible] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { config: cachedConfig, timestamp } = JSON.parse(stored) as { config: typeof DEFAULT_CONFIG; timestamp: number };
        if (Date.now() - (timestamp || 0) < CACHE_TTL_MS && Array.isArray(cachedConfig)) {
          setConfig(cachedConfig);
          setSyncStatus('local');
          return;
        }
      }

      if (profile?.municipio) {
        const { data } = await supabase
          .from('risk_configs')
          .select('configuracao')
          .eq('municipio', profile.municipio)
          .single();
        if (data?.configuracao) {
          setConfig(data.configuracao as typeof DEFAULT_CONFIG);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ config: data.configuracao, timestamp: Date.now() }));
          setSyncStatus('cloud');
        }
      }
    } catch {
      // Mantém a configuração padrão quando cache ou rede não estão disponíveis.
    } finally {
      setLoading(false);
    }
  };

  const salvar = async () => {
    for (let i = 0; i < config.length; i++) {
      if (!config[i].descricao.trim() || config[i].maxPontos < config[i].minPontos) {
        Alert.alert('Configuração inválida', `Revise descrição e intervalo de ${config[i].label}.`);
        return;
      }
      if (i > 0 && config[i].minPontos !== config[i - 1].maxPontos + 1) {
        Alert.alert(
          'Configuração inválida',
          `O intervalo de ${config[i].label} deve começar em ${config[i - 1].maxPontos + 1}, sem lacunas ou sobreposição.`,
        );
        return;
      }
    }

    setSalvando(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ config, timestamp: Date.now() }));
      if (profile?.municipio) {
        await supabase.from('risk_configs').upsert({
          municipio: profile.municipio,
          configuracao: config,
          atualizado_por: profile.uid,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'municipio' });
        setSyncStatus('cloud');
      }
      setEditMode(false);
      Alert.alert('Regras salvas', profile?.municipio
        ? 'A configuração foi sincronizada com os administradores do município.'
        : 'A configuração foi salva neste aparelho.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as regras de risco.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarReset = async () => {
    setResetVisible(false);
    setConfig(DEFAULT_CONFIG);
    await AsyncStorage.removeItem(STORAGE_KEY);
    if (profile?.municipio) {
      await supabase.from('risk_configs').delete().eq('municipio', profile.municipio);
    }
    setSyncStatus(null);
    setEditMode(false);
    Alert.alert('Padrão restaurado', 'As regras padrão voltaram a ficar ativas.');
  };

  const updateField = (nivel: string, field: 'minPontos' | 'maxPontos' | 'descricao', value: string) => {
    setConfig(prev => prev.map(c => c.nivel === nivel
      ? { ...c, [field]: field === 'descricao' ? value : parseInt(value, 10) || 0 }
      : c
    ));
  };

  const riskVisual = (nivel: string) => {
    if (nivel === 'r1') return { color: theme.riscoR1, background: theme.riscoR1Light };
    if (nivel === 'r2') return { color: theme.riscoR2, background: theme.riscoR2Light };
    if (nivel === 'r3') return { color: theme.riscoR3, background: theme.riscoR3Light };
    return { color: theme.riscoR4, background: theme.riscoR4Light };
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Regras de risco"
          subtitle="Faixas de pontuação do município"
          onBack={() => router.back()}
          actionIcon={editMode ? 'x' : 'edit-2'}
          actionLabel={editMode ? 'Cancelar edição' : 'Editar regras'}
          onAction={() => setEditMode(!editMode)}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]} keyboardShouldPersistTaps="handled">
        <StateBanner
          title={syncStatus === 'cloud' ? 'Sincronizado com o município' : syncStatus === 'local' ? 'Configuração carregada do aparelho' : 'Configuração padrão ativa'}
          description="A pontuação é calculada pela soma dos pesos. As faixas precisam ser contínuas e não podem se sobrepor."
          variant={syncStatus === 'local' ? 'warning' : 'info'}
        />

        {config.map((item, index) => {
          const visual = riskVisual(item.nivel);
          return (
            <View key={item.nivel} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.riskIcon, { backgroundColor: visual.background }]}>
                  <Feather name="alert-triangle" size={18} color={visual.color} />
                </View>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{item.label}</Text>
                <Badge label={item.nivel.toUpperCase()} variant={item.nivel as any} size="sm" />
              </View>

              {editMode ? (
                <View style={styles.editorFields}>
                  <FormField
                    label="Orientação operacional"
                    required
                    value={item.descricao}
                    onChangeText={value => updateField(item.nivel, 'descricao', value)}
                    placeholder="Descreva a ação esperada"
                  />
                  <View style={styles.rangeRow}>
                    <FormField
                      label="Mínimo"
                      required
                      containerStyle={styles.rangeItem}
                      value={String(item.minPontos)}
                      onChangeText={value => updateField(item.nivel, 'minPontos', value)}
                      keyboardType="numeric"
                      editable={index > 0}
                    />
                    <Feather name="arrow-right" size={18} color={theme.textSecondary} style={styles.rangeArrow} />
                    <FormField
                      label="Máximo"
                      required
                      containerStyle={styles.rangeItem}
                      value={item.maxPontos === 9999 ? '∞' : String(item.maxPontos)}
                      onChangeText={value => updateField(item.nivel, 'maxPontos', value)}
                      keyboardType="numeric"
                      editable={index < config.length - 1}
                    />
                  </View>
                </View>
              ) : (
                <>
                  <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>{item.descricao}</Text>
                  <View style={[styles.rangeDisplay, { backgroundColor: visual.background }]}>
                    <Text style={[styles.rangeText, { color: visual.color }]}>
                      {item.minPontos} — {item.maxPontos === 9999 ? '∞' : item.maxPontos} pontos
                    </Text>
                  </View>
                </>
              )}
            </View>
          );
        })}

        {editMode ? (
          <View style={styles.actions}>
            <Button label="Salvar regras" variant="primary" size="lg" onPress={salvar} loading={salvando} disabled={salvando} fullWidth />
            <Button label="Restaurar padrão" variant="secondary" onPress={() => setResetVisible(true)} fullWidth />
          </View>
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={resetVisible}
        title="Restaurar regras padrão?"
        description="A configuração personalizada deste município será removida para todos os administradores."
        onDismiss={() => setResetVisible(false)}
        actions={[
          { label: 'Restaurar padrão', variant: 'danger', onPress: confirmarReset },
          { label: 'Cancelar', variant: 'ghost', onPress: () => setResetVisible(false) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 60, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  riskIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  cardDescription: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  rangeDisplay: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  rangeText: { fontSize: 14, fontWeight: '700' },
  editorFields: { gap: 14 },
  rangeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rangeItem: { flex: 1 },
  rangeArrow: { marginTop: 39 },
  actions: { gap: 12, marginTop: 4 },
});
