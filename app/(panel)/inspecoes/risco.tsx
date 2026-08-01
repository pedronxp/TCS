import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { Card, Badge, Button } from '../../../components/ui';
import { supabase } from '../../../utils/supabase';
import { insertVistoria, markSincronizado, getVistoriaById } from '../../../utils/database';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { notificarVistoriaSalva } from '../../../services/NotificationService';
import { logger } from '../../../utils/logger';
import { generateUUID } from '../../../utils/uuid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RISCO_CONFIG: Record<string, {
  label: string; emoji: string; color: string; conduta: string;
}> = {
  r1: {
    label: 'BAIXO',
    emoji: '✅',
    color: '#10B981',
    conduta: 'A estrutura apresenta condições adequadas. Recomenda-se monitoramento preventivo periódico e manutenção de rotina para manter a segurança.',
  },
  baixo: {
    label: 'BAIXO',
    emoji: '✅',
    color: '#10B981',
    conduta: 'A estrutura apresenta condições adequadas. Recomenda-se monitoramento preventivo periódico e manutenção de rotina para manter a segurança.',
  },
  r2: {
    label: 'MÉDIO',
    emoji: '⚠️',
    color: '#F59E0B',
    conduta: 'Foram identificadas irregularidades que requerem atenção. Recomenda-se laudo técnico complementar e medidas de reforço estrutural em curto prazo.',
  },
  medio: {
    label: 'MÉDIO',
    emoji: '⚠️',
    color: '#F59E0B',
    conduta: 'Foram identificadas irregularidades que requerem atenção. Recomenda-se laudo técnico complementar e medidas de reforço estrutural em curto prazo.',
  },
  r3: {
    label: 'ALTO',
    emoji: '🚨',
    color: '#EF4444',
    conduta: 'ATENÇÃO: Risco elevado detectado. Recomenda-se interdição preventiva imediata e evacuação de moradores até conclusão de laudo estrutural por engenheiro habilitado.',
  },
  r4: {
    label: 'CRÍTICO',
    emoji: '⛔',
    color: '#DC2626',
    conduta: 'EMERGÊNCIA: Risco crítico à vida. Evacuar imediatamente. Acionar defesa civil municipal e corpo de bombeiros. Interdição obrigatória até análise estrutural completa.',
  },
  // Aliases para strings legadas do motor de formulários
  critico: {
    label: 'CRÍTICO',
    emoji: '⛔',
    color: '#DC2626',
    conduta: 'EMERGÊNCIA: Risco crítico à vida. Evacuar imediatamente. Acionar defesa civil municipal e corpo de bombeiros. Interdição obrigatória até análise estrutural completa.',
  },
  iminente: {
    label: 'CRÍTICO',
    emoji: '⛔',
    color: '#DC2626',
    conduta: 'EMERGÊNCIA: Risco crítico à vida. Evacuar imediatamente. Acionar defesa civil municipal e corpo de bombeiros. Interdição obrigatória até análise estrutural completa.',
  },
  alto: {
    label: 'ALTO',
    emoji: '🚨',
    color: '#EF4444',
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
          const { error } = await supabase.from('vistorias').upsert({
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
          });
          if (!error) {
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerLabel, { color: theme.textSecondary }]}>RESULTADO DA ANÁLISE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Card de Risco */}
        <Card style={styles.heroCard as any}>
          <View style={[styles.heroCardInner, { backgroundColor: config.color }]}>
            <View style={styles.emojiWrap}>
              <Text style={styles.emoji}>{config.emoji}</Text>
            </View>
            <Badge
              label={`RISCO ${config.label}`}
              variant={nivelBadgeVariant}
              size="md"
            />
            <View style={styles.pontosBadge}>
              <Text style={styles.pontosValue}>{pontosNum}</Text>
              <Text style={styles.pontosSuffix}> pts</Text>
            </View>
            {endereco ? (
              <Text style={styles.enderecoHero} numberOfLines={2}>{endereco}</Text>
            ) : null}
          </View>
        </Card>

        {/* Conduta Recomendada */}
        <Card style={{ marginBottom: 16 }}>
          <View style={styles.cardHeader}>
            <Feather name="info" size={18} color={config.color} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Conduta Recomendada</Text>
          </View>
          <Text style={[styles.conduta, { color: theme.textSecondary }]}>{config.conduta}</Text>
        </Card>

        {/* Ações */}
        <Button
          variant="ghost"
          label="Comprovante de Respostas"
          onPress={() => setShowRespostas(true)}
          iconLeft={<Feather name="list" size={20} color={theme.primary} />}
          style={{ marginBottom: 12 }}
        />

        <Button
          variant="ghost"
          label="Gerar PDF / Laudo"
          onPress={() => router.push(`/(panel)/inspecoes/resultado?id=${id}`)}
          iconLeft={<Feather name="file-text" size={20} color={theme.primary} />}
          style={{ marginBottom: 12 }}
        />

        <Button
          variant="primary"
          label={saving ? 'Processando...' : 'Salvar Relatório'}
          onPress={handleSalvar}
          loading={saving}
          disabled={saving}
          style={{ marginTop: 8 }}
        />
      </ScrollView>

      {/* Modal: Comprovante de Respostas */}
      <Modal visible={showRespostas} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Comprovante de Respostas</Text>
            <TouchableOpacity onPress={() => setShowRespostas(false)}>
              <Feather name="x" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {Object.entries(parsedRespostas).length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Nenhuma resposta registrada.</Text>
            ) : (
              Object.entries(parsedRespostas).map(([key, value]) => (
                <View key={key} style={[styles.respostaCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
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
  header: {
    paddingBottom: 16, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  headerLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  scrollContent: { padding: 24, paddingBottom: 60 },

  heroCard: {
    marginBottom: 24,
    overflow: 'hidden',
    padding: 0,
  },
  heroCardInner: {
    borderRadius: 24, padding: 32, alignItems: 'center',
  },
  emojiWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emoji: { fontSize: 40 },
  pontosBadge: {
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  pontosValue: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  pontosSuffix: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500' },
  enderecoHero: {
    color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center',
    fontWeight: '500', marginTop: 4,
  },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  conduta: { fontSize: 14, lineHeight: 22, fontWeight: '500' },

  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalContent: { padding: 24, paddingBottom: 60 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 40 },
  respostaCard: {
    borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 12,
  },
  respostaKey: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  respostaValue: { fontSize: 15, fontWeight: '600' },
});
