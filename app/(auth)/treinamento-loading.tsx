import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useTraining } from '../../context/TrainingContext';
import { trainingEntryMessage, TrainingEntryResult } from '../../services/TrainingService';
import { supabase } from '../../utils/supabase';
import { ProductIdentity } from '../../components/brand';
import { SafeAreaView } from 'react-native-safe-area-context';

const SUCCESS_VISIBLE_MS = 5000;

export default function TreinamentoLoadingScreen() {
  const { theme } = useTheme();
  const { nome, token } = useLocalSearchParams<{ nome?: string; token?: string }>();
  const { enter } = useTraining();
  const [result, setResult] = useState<TrainingEntryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const res = await enter({ nome: nome || '', token: token || '' });
        if (res.ok) {
          await supabase.auth.signOut().catch(() => null);
        }
        if (!alive) return;
        setResult(res);
        setLoading(false);
        if (res.ok) {
          setRedirecting(true);
          setTimeout(() => {
            if (alive) router.replace('/(panel)/treinamento');
          }, SUCCESS_VISIBLE_MS);
        }
      } catch (e: any) {
        if (!alive) return;
        setResult({ ok: false, status: 'error', message: e?.message || 'Falha ao acessar treinamento.' });
        setLoading(false);
      }
    };
    void run();
    return () => { alive = false; };
  }, [enter, nome, token]);

  const ok = result?.ok === true;
  const pendingAccess = loading || (ok && redirecting);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ProductIdentity variant="compact" />
      <Text style={[styles.title, { color: theme.text }]}>
        {loading ? 'Validando treinamento' : ok ? 'Entrada confirmada' : 'Acesso indisponível'}
      </Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        {loading && !ok
          ? 'Conferindo token, horário e limite da turma.'
          : ok
            ? `${result?.className || 'Turma'} · ${result?.participantCount || 0}/${result?.participantLimit || 0} alunos conectados`
            : trainingEntryMessage(result || { status: 'error' })}
      </Text>

      <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {pendingAccess ? (
          <ActivityIndicator size="large" color={theme.primary} />
        ) : ok ? (
          <Feather name="check-circle" size={42} color={theme.success} />
        ) : (
          <Feather name="alert-circle" size={42} color={theme.error} />
        )}
        {ok && (
          <Text style={[styles.countText, { color: theme.text }]}>
            {result?.participantCount || 0} de {result?.participantLimit || 0} participantes
          </Text>
        )}
      </View>

      {!loading && !ok && (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar ao acesso de treinamento" style={[styles.backBtn, { borderColor: theme.border }]} onPress={() => router.replace('/(auth)/treinamento')}>
          <Feather name="arrow-left" size={16} color={theme.textSecondary} />
          <Text style={[styles.backText, { color: theme.textSecondary }]}>Voltar</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, marginBottom: 24 },
  statusCard: {
    width: '100%',
    minHeight: 112,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  countText: { fontSize: 16, fontWeight: '800' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 22,
  },
  backText: { fontSize: 14, fontWeight: '700' },
});
