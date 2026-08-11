import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Modal, Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { AppHeader, Badge, Button, Card, EmptyState, StateBanner } from '../../../components/ui';
import { supabase } from '../../../utils/supabase';
import { insertVistoria, markSincronizado, storeOfficialProtocol, getVistoriaById } from '../../../utils/database';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { notificarVistoriaSalva } from '../../../services/NotificationService';
import { logger } from '../../../utils/logger';
import { generateUUID } from '../../../utils/uuid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';

const RISCO_CONFIG: Record<string, {
  label: string; emoji: string; conduta: string;
}> = {
  r1: {
    label: 'BAIXO',
    emoji: '✅',
    conduta: 'A estrutura apresenta condições adequadas. Recomenda-se monitoramento preventivo periódico e manutenção de rotina para manter a segurança.',
  },
  baixo: {
    label: 'BAIXO',
    emoji: '✅',
    conduta: 'A estrutura apresenta condições adequadas. Recomenda-se monitoramento preventivo periódico e manutenção de rotina para manter a segurança.',
  },
  r2: {
    label: 'MÉDIO',
    emoji: '⚠️',
    conduta: 'Foram identificadas irregularidades que requerem atenção. Recomenda-se laudo técnico complementar e medidas de reforço estrutural em curto prazo.',
  },
  medio: {
    label: 'MÉDIO',
    emoji: '⚠️',
    conduta: 'Foram identificadas irregularidades que requerem atenção. Recomenda-se laudo técnico complementar e medidas de reforço estrutural em curto prazo.',
  },
  r3: {
    label: 'ALTO',
    emoji: '🚨',
    conduta: 'ATENÇÃO: Risco elevado detectado. Recomenda-se interdição preventiva imediata e evacuação de moradores até conclusão de laudo estrutural por engenheiro habilitado.',
  },
  r4: {
    label: 'CRÍTICO',
    emoji: '⛔',
    conduta: 'EMERGÊNCIA: Risco crítico à vida. Evacuar imediatamente. Acionar defesa civil municipal e corpo de bombeiros. Interdição obrigatória até análise estrutural completa.',
  },
  // Aliases para strings legadas do motor de formulários
  critico: {
    label: 'CRÍTICO',
    emoji: '⛔',
    conduta: 'EMERGÊNCIA: Risco crítico à vida. Evacuar imediatamente. Acionar defesa civil municipal e corpo de bombeiros. Interdição obrigatória até análise estrutural completa.',
  },
  iminente: {
    label: 'CRÍTICO',
    emoji: '⛔',
    conduta: 'EMERGÊNCIA: Risco crítico à vida. Evacuar imediatamente. Acionar defesa civil municipal e corpo de bombeiros. Interdição obrigatória até análise estrutural completa.',
  },
  alto: {
    label: 'ALTO',
    emoji: '🚨',
    conduta: 'ATENÇÃO: Risco elevado detectado. Recomenda-se interdição preventiva imediata e evacuação de moradores até conclusão de laudo estrutural por engenheiro habilitado.',
  },
};

export default function ResultadoRiscoScreen() {
  const { id, nivel, pontos, endereco, respostas } = useLocalSearchParams<{
    id: string;
    nivel: string;
    pontos: string;
    endereco: string;
    respostas: string;
  }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { isOnlineReal: isConnected } = useConnectivity();
  const [saving, setSaving] = useState(false);
  const [showRespostas, setShowRespostas] = useState(false);

  const config = RISCO_CONFIG[nivel?.toLowerCase() || 'r1'] || RISCO_CONFIG.r1;
  const pontosNum = parseFloat(pontos || '0') || 0;

  // Normaliza nivel para variante do Badge (R1/R2/R3/R4)
  const nivelBadgeVariant = (() => {
    const n = nivel?.toLowerCase() || 'r1';
    if (n === 'r1' || n === 'baixo') return 'R1';
    if (n === 'r2' || n === 'medio') return 'R2';
    if (n === 'r3' || n === 'alto') return 'R3';
    if (n === 'r4' || n === 'critico' || n === 'iminente') return 'R4';
    return 'R1';
  })() as 'R1' | 'R2' | 'R3' | 'R4';
  const riskColor = nivelBadgeVariant === 'R1'
    ? theme.success
    : nivelBadgeVariant === 'R2' ? theme.warning : theme.error;
  const riskStateVariant = nivelBadgeVariant === 'R1'
    ? 'success' as const
    : nivelBadgeVariant === 'R2' ? 'warning' as const : 'danger' as const;
  const riskIcon = nivelBadgeVariant === 'R1' ? 'check-circle' : nivelBadgeVariant === 'R2' ? 'alert-circle' : 'alert-triangle';

  const parsedRespostas: Record<string, any> = (() => {
    try { return JSON.parse(respostas || '{}'); } catch { return {}; }
  })();

  const handleSalvar = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/(auth)/login'); return; }

      const vistoriaId = id || generateUUID();

      // Verificar se já foi salva pelo wizard — evita sobrescrever dados completos
      // com dados incompletos desta tela (lat/lng 0, formulario_id vazio, etc.)
      const jaExiste = id ? getVistoriaById(id) : null;

      if (!jaExiste) {
        const { data: user } = await supabase
          .from('users').select('name, municipio').eq('uid', session.user.id).single();

        const now = new Date().toISOString();
        insertVistoria({
          id: vistoriaId,
          agente_uid: session.user.id,
          agente_nome: user?.name || '',
          municipio: user?.municipio || '',
          endereco_rua: endereco || '',
          endereco_numero: '',
          endereco_bairro: '',
          endereco_cep: null,
          responsavel_nome: null,
          latitude: 0,
          longitude: 0,
          data_vistoria: now,
          formulario_id: '',
          formulario_versao: 1,
          nivel_risco: nivel || 'r1',
          pontuacao_total: pontosNum,
          calculo_json: null,
          respostas_json: respostas || '{}',
          foto_url: null,
          feita_online: isConnected ? 1 : 0,
          criado_em: now,
        });

        if (isConnected) {
          const { data, error } = await supabase.rpc('sync_finalized_inspection', { p_inspection: {
            id: vistoriaId,
            agenteUid: session.user.id,
            agenteNome: user?.name,
            municipio: user?.municipio,
            endereco: endereco,
            nivelRisco: nivel,
            pontuacaoTotal: pontosNum,
            calculoRisco: null,
            respostasJson: respostas,
            dataVistoria: now,
            status: 'concluida',
          }});
          if (!error) {
            if (typeof data?.protocol === 'string') storeOfficialProtocol(vistoriaId, data.protocol);
            markSincronizado(vistoriaId);
          }
        }

        notificarVistoriaSalva(endereco || 'Local não informado', nivel || 'r1').catch(() => null);
      }

      Alert.alert(
        'Vistoria Salva',
        isConnected
          ? 'Relatório sincronizado com sucesso.'
          : 'Salvo localmente. Será sincronizado quando houver conexão.',
        [{ text: 'OK', onPress: () => router.replace('/(panel)/dashboard') }]
      );
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar a vistoria.');
      logger.error('vistoria', 'Erro ao salvar', { erro: String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader title="Classificação de risco" subtitle="Resultado técnico da análise" onBack={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}>
        {/* Hero Card de Risco */}
        <Card style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={[styles.riskIcon, { backgroundColor: `${riskColor}15` }]}>
              <Feather name={riskIcon} size={30} color={riskColor} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroEyebrow, { color: theme.textSecondary }]}>RESULTADO</Text>
              <Text style={[styles.heroTitle, { color: theme.text }]}>Risco {config.label.toLowerCase()}</Text>
              <Badge label={`RISCO ${config.label}`} variant={nivelBadgeVariant} size="md" />
            </View>
            <View style={[styles.pontosBadge, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Text style={[styles.pontosValue, { color: theme.text }]}>{pontosNum}</Text>
              <Text style={[styles.pontosSuffix, { color: theme.textSecondary }]}>pts</Text>
            </View>
          </View>
          {endereco ? (
            <View style={[styles.addressRow, { borderTopColor: theme.border }]}>
              <Feather name="map-pin" size={15} color={theme.textSecondary} />
              <Text style={[styles.enderecoHero, { color: theme.textSecondary }]} numberOfLines={2}>{endereco}</Text>
            </View>
          ) : null}
        </Card>

        {/* Conduta Recomendada */}
        <StateBanner variant={riskStateVariant} title="Conduta recomendada" description={config.conduta} />

        {/* Ações */}
        <Button
          variant="secondary"
          label="Comprovante de respostas"
          onPress={() => setShowRespostas(true)}
          iconLeft={<Feather name="list" size={20} color={theme.primary} />}
          style={{ marginBottom: 12 }}
        />

        <Button
          variant="secondary"
          label="Gerar PDF / Laudo"
          onPress={() => router.push(`/(panel)/inspecoes/resultado?id=${id}`)}
          iconLeft={<Feather name="file-text" size={20} color={theme.primary} />}
          style={{ marginBottom: 12 }}
        />

        <Button
          variant="primary"
          label={saving ? 'Processando...' : 'Salvar relatório'}
          onPress={handleSalvar}
          loading={saving}
          disabled={saving}
          style={{ marginTop: 8 }}
        />
      </ScrollView>

      {/* Modal: Comprovante de Respostas */}
      <Modal visible={showRespostas} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={{ paddingTop: insets.top }}>
            <AppHeader title="Comprovante de respostas" subtitle={`${Object.keys(parsedRespostas).length} itens registrados`} onBack={() => setShowRespostas(false)} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {Object.entries(parsedRespostas).length === 0 ? (
              <EmptyState icon="list" title="Nenhuma resposta registrada" description="As respostas preenchidas na vistoria aparecerão aqui." />
            ) : (
              Object.entries(parsedRespostas).map(([key, value]) => (
                <View key={key} style={[styles.respostaCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                  <Text style={[styles.respostaKey, { color: theme.textSecondary }]}>Parâmetro: {key}</Text>
                  <Text style={[styles.respostaValue, { color: theme.text }]}>
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },

  heroCard: {
    marginBottom: 16,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  riskIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, gap: 5 },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { fontSize: 21, fontWeight: '800', textTransform: 'capitalize' },
  pontosBadge: {
    minWidth: 62, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9,
    borderRadius: 14, borderWidth: 1,
  },
  pontosValue: { fontSize: 20, fontWeight: '800' },
  pontosSuffix: { fontSize: 10, fontWeight: '600' },
  addressRow: { borderTopWidth: 1, marginTop: 16, paddingTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  enderecoHero: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },

  modalContainer: { flex: 1 },
  modalContent: { padding: 24, paddingBottom: 60 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 40 },
  respostaCard: {
    borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 12,
  },
  respostaKey: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  respostaValue: { fontSize: 15, fontWeight: '600' },
});
