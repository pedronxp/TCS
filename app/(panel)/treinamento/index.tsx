import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { useTraining } from '../../../context/TrainingContext';
import { getTrainingVistoriasByAgente, VistoriaLocal } from '../../../utils/database';
import { AppHeader, Card, EmptyState, MetricCard, StateBanner } from '../../../components/ui';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';

export default function TrainingDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { session, trainingProfile, exit, isExpired, revalidate } = useTraining();
  const [history, setHistory] = useState<VistoriaLocal[]>([]);
  const [startingInspection, setStartingInspection] = useState(false);
  const startingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkingSessionRef = useRef(false);

  useEffect(() => () => {
    if (startingTimerRef.current) clearTimeout(startingTimerRef.current);
  }, []);

  const loadHistory = useCallback(() => {
    if (!trainingProfile) return;
    setHistory(getTrainingVistoriasByAgente(trainingProfile.uid));
  }, [trainingProfile?.uid]);

  useFocusEffect(useCallback(() => {
    let alive = true;

    const checkSession = async () => {
      if (checkingSessionRef.current) return;
      if (!session || !trainingProfile || isExpired()) {
        await exit();
        if (alive) router.replace('/(auth)/treinamento');
        return;
      }

      checkingSessionRef.current = true;
      try {
        loadHistory();
        const ok = await revalidate();
        if (!ok) {
          if (alive) router.replace('/(auth)/treinamento');
          return;
        }

        if (alive) loadHistory();
      } finally {
        checkingSessionRef.current = false;
      }
    };

    void checkSession();
    return () => { alive = false; };
  }, [session?.participantId, trainingProfile?.uid, loadHistory, revalidate, exit, isExpired]));

  const sair = () => {
    Alert.alert(
      'Sair do treinamento?',
      'O acesso da turma será encerrado neste aparelho. As vistorias locais continuam salvas no histórico local enquanto o app mantiver os dados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => exit().finally(() => router.replace('/(auth)')) },
      ],
    );
  };

  const iniciarVistoria = () => {
    if (startingInspection) return;
    if (!session || !trainingProfile || isExpired()) {
      void exit().finally(() => router.replace('/(auth)/treinamento'));
      return;
    }
    setStartingInspection(true);
    router.push({
      pathname: '/(panel)/inspecoes/dados-iniciais',
      params: { treinamento: '1' },
    });
    if (startingTimerRef.current) clearTimeout(startingTimerRef.current);
    startingTimerRef.current = setTimeout(() => setStartingInspection(false), 1000);
    void revalidate().then(ok => {
      if (!ok) {
        return exit().finally(() => router.replace('/(auth)/treinamento'));
      }
      return undefined;
    });
  };

  const expira = session?.endsAt
    ? new Date(session.endsAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '--';
  const totalAlunos = session?.participantLimit || 1;
  const alunosConectados = session?.participantCount || 0;
  const progress = Math.min(100, Math.max(0, (alunosConectados / totalAlunos) * 100));
  const highRiskCount = history.filter(item => item.nivel_risco === 'r3' || item.nivel_risco === 'r4').length;

  if (!session || !trainingProfile) {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title={`Olá, ${session.participantName.split(' ')[0]}`}
          subtitle={`${session.className} · modo treinamento`}
          actionIcon="log-out"
          actionLabel="Sair do treinamento"
          onAction={sair}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>
        <StateBanner
          variant="success"
          title="Aula ativa"
          description={`Acesso disponível até ${expira}. Os dados permanecem somente neste aparelho.`}
        />

        <View style={[styles.statusPanel, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIcon, { backgroundColor: theme.successLight }]}>
              <Feather name="users" size={18} color={theme.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: theme.text }]}>Participação da turma</Text>
              <Text style={[styles.statusSubtitle, { color: theme.textSecondary }]}>{alunosConectados} de {totalAlunos} participantes conectados</Text>
            </View>
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.cardBorder }]}>
            <View style={[styles.progressValue, { width: `${progress}%`, backgroundColor: theme.success }]} />
          </View>
          <View style={styles.statusMeta}>
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>{Math.round(progress)}% da capacidade</Text>
            <Text style={[styles.metaText, { color: theme.success }]}>Dados locais</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <MetricCard value={history.length} label="Vistorias locais" tone="primary" style={styles.metricCard} />
          <MetricCard value={highRiskCount} label="Riscos R3/R4" tone="danger" style={styles.metricCard} />
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Iniciar nova vistoria de treinamento"
          accessibilityState={{ disabled: startingInspection }}
          style={[styles.primaryAction, { backgroundColor: theme.primary, opacity: startingInspection ? 0.72 : 1 }]}
          onPress={iniciarVistoria}
          disabled={startingInspection}
          activeOpacity={0.88}
        >
          <View style={[styles.primaryIcon, { backgroundColor: `${theme.onPrimary}26` }]}>
            <Feather name="plus-circle" size={30} color={theme.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.primaryTitle, { color: theme.onPrimary }]}>Nova Vistoria</Text>
            <Text style={[styles.primarySub, { color: `${theme.onPrimary}C7` }]}>Fluxo completo com os 2 formulários da turma</Text>
          </View>
            <Feather name="arrow-right" size={18} color={`${theme.onPrimary}C2`} />
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Histórico local</Text>
        {history.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title="Nenhuma vistoria local"
            description="As vistorias feitas no treinamento aparecerão aqui."
          />
        ) : (
          history.map(item => {
            const cor = item.nivel_risco === 'r1' ? theme.success : item.nivel_risco === 'r2' ? theme.warning : theme.error;
            const endereco = [item.endereco_rua, item.endereco_numero].filter(Boolean).join(', ') || 'Endereço não informado';
            return (
              <Card
                key={item.id}
                style={{ marginBottom: 12 }}
                onPress={() => router.push({
                  pathname: '/(panel)/inspecoes/resultado',
                  params: {
                    id: item.id,
                    nivelRisco: item.nivel_risco,
                    pontuacao: String(item.pontuacao_total ?? 0),
                    municipio: item.municipio,
                    treinamento: '1',
                  },
                })}
              >
                <View style={styles.historyRow}>
                  <View style={[styles.riskBadge, { backgroundColor: cor }]}>
                    <Text style={styles.riskText}>{item.nivel_risco?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyTitle, { color: theme.text }]} numberOfLines={1}>
                      {endereco}
                    </Text>
                    <Text style={[styles.historySub, { color: theme.textSecondary }]}>
                      {item.pontuacao_total} pts · {new Date(item.data_vistoria).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={17} color={theme.textSecondary} />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 14 },
  statusPanel: { borderWidth: 1, borderRadius: 18, padding: 16 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { fontSize: 16, fontWeight: '900' },
  statusSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  progressBar: { height: 7, borderRadius: 999, overflow: 'hidden' },
  progressValue: { height: 7, borderRadius: 999 },
  statusMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 9 },
  metaText: { fontSize: 11, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { flexGrow: 1, flexBasis: '46%' },
  primaryAction: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 18, marginBottom: 10 },
  primaryIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  primaryTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  primarySub: { color: 'rgba(255,255,255,0.78)', fontSize: 12, marginTop: 3 },
  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riskBadge: { minWidth: 42, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, alignItems: 'center' },
  riskText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  historyTitle: { fontSize: 15, fontWeight: '800' },
  historySub: { fontSize: 12, fontWeight: '500', marginTop: 3 },
});
