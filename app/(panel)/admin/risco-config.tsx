import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';

const STORAGE_KEY = '@risco_config_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

const DEFAULT_CONFIG = [
  { nivel: 'r1', label: 'Baixo Risco', cor: '#10B981', descricao: 'Monitoramento preventivo', minPontos: 0, maxPontos: 24 },
  { nivel: 'r2', label: 'Risco Médio', cor: '#F59E0B', descricao: 'Vistoria técnica necessária', minPontos: 25, maxPontos: 49 },
  { nivel: 'r3', label: 'Risco Alto', cor: '#EF4444', descricao: 'Laudo de engenheiro obrigatório', minPontos: 50, maxPontos: 74 },
  { nivel: 'r4', label: 'Risco Crítico', cor: '#7C3AED', descricao: 'Recomendar interdição imediata', minPontos: 75, maxPontos: 9999 },
];

export default function RiscoConfigScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [editMode, setEditMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'local' | 'cloud' | null>(null);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      // 1. Checar cache local com TTL de 24h
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { config: cachedConfig, timestamp } = JSON.parse(stored) as { config: typeof DEFAULT_CONFIG; timestamp: number };
        const isRecente = Date.now() - (timestamp || 0) < CACHE_TTL_MS;
        if (isRecente && Array.isArray(cachedConfig)) {
          setConfig(cachedConfig);
          setSyncStatus('local');
          return; // Cache válido — pula o Supabase
        }
      }

      // 2. Cache expirado ou inexistente — busca do Supabase
      if (profile?.municipio) {
        const { data } = await supabase
          .from('risk_configs')
          .select('configuracao')
          .eq('municipio', profile.municipio)
          .single();
        if (data?.configuracao) {
          setConfig(data.configuracao as typeof DEFAULT_CONFIG);
          // Salva com timestamp para TTL
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ config: data.configuracao, timestamp: Date.now() }));
          setSyncStatus('cloud');
          return;
        }
      }
      // 3. Fallback para config padrão
    } catch {
      // usa default
    } finally {
      setLoading(false);
    }
  };

  const salvar = async () => {
    for (let i = 1; i < config.length; i++) {
      if (config[i].minPontos <= config[i-1].maxPontos) {
        Alert.alert('Configuração inválida', `O intervalo de ${config[i].label} deve começar após ${config[i-1].label}.`);
        return;
      }
    }
    setSalvando(true);
    try {
      // Salvar localmente sempre (com timestamp para TTL)
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ config, timestamp: Date.now() }));

      // Salvar no Supabase se tiver municipio
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
      Alert.alert('Salvo!', profile?.municipio
        ? 'Configuração sincronizada com todos os admins do município.'
        : 'Configuração salva localmente.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const resetar = () => {
    Alert.alert('Restaurar padrão?', 'Os valores padrão serão restaurados para todos os admins.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restaurar', onPress: async () => {
        setConfig(DEFAULT_CONFIG);
        await AsyncStorage.removeItem(STORAGE_KEY);
        if (profile?.municipio) {
          await supabase.from('risk_configs')
            .delete().eq('municipio', profile.municipio);
        }
        setSyncStatus(null);
        setEditMode(false);
        Alert.alert('Restaurado!', 'Valores padrão restaurados.');
      }}
    ]);
  };

  const updateField = (nivel: string, field: 'minPontos' | 'maxPontos' | 'descricao', value: string) => {
    setConfig(prev => prev.map(c => c.nivel === nivel
      ? { ...c, [field]: field === 'descricao' ? value : parseInt(value) || 0 }
      : c
    ));
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Config. de Risco</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Limiares de pontuação</Text>
            {syncStatus === 'cloud' && (
              <Feather name="cloud" size={11} color="#10B981" />
            )}
            {syncStatus === 'local' && (
              <Feather name="smartphone" size={11} color="#F59E0B" />
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.editBtn, { backgroundColor: editMode ? theme.primary : theme.iconBackground, borderColor: theme.border }]}
          onPress={() => setEditMode(!editMode)}
        >
          <Feather name={editMode ? 'check' : 'edit-2'} size={18} color={editMode ? '#FFF' : theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.infoCard, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
          <Feather name="info" size={16} color={theme.primary} />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            A pontuação de risco é calculada somando os pesos de cada resposta. Configure os intervalos abaixo para cada nível.
          </Text>
        </View>

        {config.map((c, i) => (
          <View key={c.nivel} style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder, borderLeftColor: c.cor, borderLeftWidth: 4 }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: `${c.cor}18` }]}>
                <Text style={[styles.badgeText, { color: c.cor }]}>{c.nivel.toUpperCase()}</Text>
              </View>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{c.label}</Text>
            </View>

            {editMode ? (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  value={c.descricao}
                  onChangeText={v => updateField(c.nivel, 'descricao', v)}
                  placeholder="Descrição"
                  placeholderTextColor={theme.textSecondary}
                />
                <View style={styles.rangeRow}>
                  <View style={styles.rangeItem}>
                    <Text style={[styles.rangeLabel, { color: theme.textSecondary }]}>Mín. pontos</Text>
                    <TextInput
                      style={[styles.rangeInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={String(c.minPontos)}
                      onChangeText={v => updateField(c.nivel, 'minPontos', v)}
                      keyboardType="numeric"
                      editable={i > 0}
                    />
                  </View>
                  <Feather name="arrow-right" size={18} color={theme.textSecondary} style={{ marginTop: 20 }} />
                  <View style={styles.rangeItem}>
                    <Text style={[styles.rangeLabel, { color: theme.textSecondary }]}>Máx. pontos</Text>
                    <TextInput
                      style={[styles.rangeInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      value={c.maxPontos === 9999 ? '∞' : String(c.maxPontos)}
                      onChangeText={v => updateField(c.nivel, 'maxPontos', v)}
                      keyboardType="numeric"
                      editable={i < config.length - 1}
                    />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>{c.descricao}</Text>
                <View style={[styles.rangeDisplay, { backgroundColor: `${c.cor}10` }]}>
                  <Text style={[styles.rangeDisplayText, { color: c.cor }]}>
                    {c.minPontos} — {c.maxPontos === 9999 ? '∞' : c.maxPontos} pontos
                  </Text>
                </View>
              </>
            )}
          </View>
        ))}

        {editMode && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: salvando ? theme.textSecondary : theme.primary }]} onPress={salvar} disabled={salvando}>
              {salvando ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="save" size={18} color="#FFF" />}
              <Text style={styles.saveBtnText}>{salvando ? 'Salvando...' : 'Salvar Configuração'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.resetBtn, { borderColor: theme.border }]} onPress={resetar}>
              <Feather name="rotate-ccw" size={16} color={theme.textSecondary} />
              <Text style={[styles.resetText, { color: theme.textSecondary }]}>Restaurar Padrão</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  editBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 60 },
  infoCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardDesc: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  rangeDisplay: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  rangeDisplayText: { fontSize: 14, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 14, marginBottom: 10 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeItem: { flex: 1 },
  rangeLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  rangeInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  actionRow: { gap: 12, marginTop: 8 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 56, borderRadius: 16,
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 48, borderRadius: 14, borderWidth: 1,
  },
  resetText: { fontSize: 14, fontWeight: '600' },
});
