import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useOwnerExperience } from '../context/OwnerExperienceContext';
import { useTheme } from '../context/ThemeContext';
import { Button, ModuleCard } from './ui';

export function OwnerExperienceChoice() {
  const { theme } = useTheme();
  const { mode, loading, saving, error, reload, choose } = useOwnerExperience();
  const select = async (next: 'follow' | 'operate') => {
    if (saving) return;
    try { await choose(next); }
    catch { Alert.alert('Modo não salvo', 'Confira a conexão e tente novamente. Sua escolha anterior foi preservada.'); }
  };
  return <View style={styles.content}>
    <Text style={[styles.title, { color: theme.text }]}>Como você quer usar o aplicativo?</Text>
    <Text style={{ color: theme.textSecondary, lineHeight: 22 }}>Você continua sendo o proprietário. Escolha a experiência do celular e altere quando quiser no perfil.</Text>
    {loading ? <ActivityIndicator color={theme.primary} /> : error ? <>
      <Text accessibilityRole="alert" style={{ color: theme.error }}>{error}</Text>
      <Button label="Tentar novamente" onPress={() => void reload()} />
    </> : <>
      <ModuleCard title="Acompanhar" description="Indicadores e acompanhamento no celular; administração pelo painel web." icon="activity" badge={mode === 'follow' ? 'Selecionado' : undefined} onPress={() => void select('follow')} />
      <ModuleCard title="Administrar e operar" description="Vistorias, revisão de qualidade, contas, equipe e decisões administrativas pelo celular." icon="shield" badge={mode === 'operate' ? 'Selecionado' : undefined} onPress={() => void select('operate')} />
      {saving ? <ActivityIndicator accessibilityLabel="Salvando modo" color={theme.primary} /> : null}
    </>}
  </View>;
}
const styles = StyleSheet.create({ content: { padding: 24, gap: 20 }, title: { fontSize: 26, fontWeight: '800', lineHeight: 32 } });
