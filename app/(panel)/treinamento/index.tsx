import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { useTraining } from '../../../context/TrainingContext';
import { getTrainingVistoriasByAgente, VistoriaLocal } from '../../../utils/database';
import { Card, EmptyState } from '../../../components/ui';

const RISCO_COLORS: Record<string, string> = {
  r1: '#10B981',
  r2: '#F59E0B',
  r3: '#F97316',
  r4: '#EF4444',
};

export default function TrainingDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
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
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 14 }]}>
        <View style={[styles.headerLogoWrap, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
          <Image source={require('../../../assets/logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: '#10B981' }]}>MODO TREINAMENTO</Text>
          <Text style={[styles.title, { color: theme.text }]}>Olá, {session.participantName.split(' ')[0]}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{session.className}</Text>
        </View>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]} onPress={sair}>
          <Feather name="log-out" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.statusPanel, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIcon}>
              <Feather name="clock" size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: theme.text }]}>Aula ativa</Text>
              <Text style={[styles.statusSubtitle, { color: theme.textSecondary }]}>Disponível até {expira}</Text>
            </View>
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.cardBorder }]}>
            <View style={[styles.progressValue, { width: `${progress}%` }]} />
          </View>
          <View style={styles.statusMeta}>
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>{alunosConectados}/{totalAlunos} alunos conectados</Text>
            <Text style={[styles.metaText, { color: '#10B981' }]}>Dados locais</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <View style={styles.statTop}>
              <Feather name="file-text" size={18} color={theme.primary} />
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Vistorias</Text>
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{history.length}</Text>
            <Text style={[styles.statHint, { color: theme.textSecondary }]}>salvas neste aparelho</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <View style={styles.statTop}>
              <Feather name="alert-triangle" size={18} color="#EF4444" />
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Atenção</Text>
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{highRiskCount}</Text>
            <Text style={[styles.statHint, { color: theme.textSecondary }]}>R3/R4 no histórico</Text>
          </View>
        </View>

        <View style={[styles.notice, { borderColor: 'rgba(59,130,246,0.26)', backgroundColor: 'rgba(59,130,246,0.09)' }]}>
          <Feather name="smartphone" size={16} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.noticeTitle, { color: theme.primary }]}>Ambiente de treinamento</Text>
            <Text style={[styles.noticeText, { color: theme.textSecondary }]}>As vistorias ficam somente neste aparelho e não entram nos painéis oficiais.</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryAction, { backgroundColor: theme.primary, opacity: startingInspection ? 0.72 : 1 }]}
          onPress={iniciarVistoria}
          disabled={startingInspection}
          activeOpacity={0.88}
        >
          <View style={styles.primaryIcon}>
            <Feather name="plus-circle" size={30} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.primaryTitle}>Nova Vistoria</Text>
            <Text style={styles.primarySub}>Fluxo completo com os 2 formulários da turma</Text>
          </View>
            <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.75)" />
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
            const cor = RISCO_COLORS[item.nivel_risco] || '#94A3B8';
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
  header: { paddingBottom: 18, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, gap: 12 },
  headerLogoWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: { width: 38, height: 38 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 3 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 3 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  statusPanel: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { fontSize: 16, fontWeight: '900' },
  statusSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  progressBar: { height: 7, borderRadius: 999, overflow: 'hidden' },
  progressValue: { height: 7, borderRadius: 999, backgroundColor: '#10B981' },
  statusMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 9 },
  metaText: { fontSize: 11, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 16, gap: 7 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 12, fontWeight: '800' },
  statHint: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  notice: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  noticeTitle: { fontSize: 13, fontWeight: '800' },
  noticeText: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  primaryAction: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 18, marginBottom: 24 },
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
