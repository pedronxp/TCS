import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, SectionHeader } from '../ui';
import {
  BillingInvoice,
  diasParaVencimento,
  enviarComprovante,
  fetchMinhasFaturas,
  formatarData,
  formatarMoeda,
} from '../../utils/billing';

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aguardando pagamento',
  em_analise: 'Comprovante em análise',
  paga: 'Paga',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'error' | 'neutral'> = {
  aberta: 'warning',
  em_analise: 'info',
  paga: 'success',
  vencida: 'error',
  cancelada: 'neutral',
};

/**
 * Seção "Minhas faturas" — lista as cobranças da organização e permite
 * anexar comprovante (imagem/PDF) nas faturas abertas ou vencidas.
 */
export default function SecaoFaturas() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [faturas, setFaturas] = useState<BillingInvoice[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const data = await fetchMinhasFaturas();
      setFaturas(data);
    } catch {
      setFaturas([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.organizationId) void carregar();
    else setCarregando(false);
  }, [profile?.organizationId, carregar]);

  // Conta individual (sem org) não tem faturas por org nesta fase
  if (!profile?.organizationId) return null;

  const anexar = async (fatura: BillingInvoice) => {
    setEnviando(fatura.id);
    try {
      const resultado = await enviarComprovante(fatura);
      if (resultado === 'ok') {
        Alert.alert('Comprovante enviado', 'Nossa equipe vai analisar e confirmar seu pagamento.');
        await carregar();
      }
    } catch (e: any) {
      Alert.alert('Não foi possível enviar', 'Verifique sua conexão e tente novamente.');
    } finally {
      setEnviando(null);
    }
  };

  return (
    <View>
      <SectionHeader title="Faturas" subtitle="Cobranças e comprovantes da sua organização" />

      {carregando ? (
        <Text style={[styles.vazio, { color: theme.textSecondary }]}>Carregando faturas…</Text>
      ) : faturas.length === 0 ? (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.vazio, { color: theme.textSecondary }]}>
            Nenhuma fatura gerada ainda. A primeira cobrança aparece perto do fim do teste.
          </Text>
        </View>
      ) : (
        faturas.map(f => {
          const dias = diasParaVencimento(f.vencimento);
          const podeAnexar = f.status === 'aberta' || f.status === 'vencida';
          return (
            <View key={f.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.linhaTopo}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.competencia, { color: theme.text }]}>
                    Fatura {f.competencia}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textSecondary }]}>
                    Vence em {formatarData(f.vencimento)}
                    {f.status === 'aberta'
                      ? ` · ${dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `${dias} dias`}`
                      : ''}
                  </Text>
                </View>
                <Badge label={STATUS_LABEL[f.status] ?? f.status} variant={STATUS_VARIANT[f.status] ?? 'neutral'} size="sm" />
              </View>

              <Text style={[styles.valor, { color: theme.text }]}>{formatarMoeda(f.valor_centavos)}</Text>

              {f.status === 'em_analise' ? (
                <View style={[styles.alerta, { backgroundColor: theme.secondary }]}>
                  <Feather name="clock" size={14} color={theme.primary} />
                  <Text style={[styles.alertaTexto, { color: theme.textSecondary }]}>
                    Comprovante enviado. Aguarde a confirmação do pagamento.
                  </Text>
                </View>
              ) : null}

              {f.motivo_rejeicao ? (
                <View style={[styles.alerta, { backgroundColor: theme.errorLight ?? theme.secondary }]}>
                  <Feather name="alert-circle" size={14} color={theme.error} />
                  <Text style={[styles.alertaTexto, { color: theme.error }]}>
                    Comprovante recusado: {f.motivo_rejeicao}
                  </Text>
                </View>
              ) : null}

              {podeAnexar ? (
                <Button
                  label={f.comprovante_path ? 'Reenviar comprovante' : 'Anexar comprovante de pagamento'}
                  variant={f.comprovante_path ? 'secondary' : 'primary'}
                  loading={enviando === f.id}
                  onPress={() => void anexar(f)}
                  fullWidth
                  style={{ marginTop: 12 }}
                  iconLeft={<Feather name="paperclip" size={16} color={f.comprovante_path ? theme.primary : '#FFFFFF'} />}
                />
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  linhaTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  competencia: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 3 },
  valor: { fontSize: 22, fontWeight: '800', marginTop: 10 },
  alerta: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginTop: 12 },
  alertaTexto: { flex: 1, fontSize: 12, lineHeight: 16 },
  vazio: { fontSize: 13, lineHeight: 19 },
});
