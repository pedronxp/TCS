import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductIdentity } from '../../components/brand';
import { Button, Card, StateBanner } from '../../components/ui';
import { useTheme } from '../../context/ThemeContext';
import { useTraining } from '../../context/TrainingContext';
import { getPublicPreviewAccess, PublicPreviewAccess } from '../../services/PreviewAccessService';
import { Spacing } from '../../constants/Spacing';

export default function PublicPreviewScreen() {
  const { theme } = useTheme();
  const { deviceId, enterPreview } = useTraining();
  const [access, setAccess] = useState<PublicPreviewAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) return;
    setLoading(true);
    getPublicPreviewAccess(deviceId)
      .then(setAccess)
      .catch(() => setError('Não foi possível consultar o preview agora.'))
      .finally(() => setLoading(false));
  }, [deviceId]);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const result = await enterPreview();
      setAccess(result);
      if (!result.allowed) return;
      router.replace('/(panel)/treinamento');
    } catch {
      setError('O preview está temporariamente indisponível. Tente novamente.');
    } finally {
      setStarting(false);
    }
  };

  const remaining = access?.remaining ?? 2;
  const blocked = access?.allowed === false;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <ProductIdentity variant="compact" />
        <View style={[styles.icon, { backgroundColor: theme.successLight }]}>
          <Feather name="play-circle" size={30} color={theme.primary} />
        </View>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>PREVIEW DO APLICATIVO</Text>
        <Text style={[styles.title, { color: theme.text }]}>Experimente uma vistoria</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Conheça o fluxo técnico sem criar conta. Os dados ficam somente neste aparelho e não entram na operação oficial.
        </Text>

        <Card style={styles.limitCard}>
          <View style={styles.limitRow}>
            <Feather name="shield" size={19} color={theme.primary} />
            <View style={styles.limitCopy}>
              <Text style={[styles.limitTitle, { color: theme.text }]}>Até 2 vistorias de demonstração</Text>
              <Text style={[styles.limitText, { color: theme.textSecondary }]}>
                {loading ? 'Consultando disponibilidade...' : `${remaining} tentativa${remaining === 1 ? '' : 's'} disponível${remaining === 1 ? '' : 'is'} nesta rede e aparelho.`}
              </Text>
            </View>
          </View>
        </Card>

        {blocked && (
          <StateBanner
            variant="warning"
            title="Preview concluído"
            description="O limite de demonstração foi utilizado. Crie uma conta para continuar ou entre em uma turma de treinamento."
          />
        )}
        {error && <StateBanner variant="danger" title="Preview indisponível" description={error} />}

        <View style={styles.actions}>
          <Button
            size="lg"
            fullWidth
            loading={starting}
            disabled={loading || blocked}
            onPress={start}
            iconRight={<Feather name="arrow-right" size={18} color={theme.onPrimary} />}
          >
            INICIAR PREVIEW
          </Button>
          {blocked && (
            <Button variant="secondary" fullWidth onPress={() => router.push('/(auth)/register')}>
              CRIAR CONTA
            </Button>
          )}
          <Button variant="ghost" fullWidth onPress={() => router.replace('/(auth)')}>
            Voltar
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing[6], gap: Spacing[4], maxWidth: 560, width: '100%', alignSelf: 'center' },
  icon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: Spacing[4] },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, lineHeight: 23 },
  limitCard: { padding: Spacing[4] },
  limitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  limitCopy: { flex: 1 },
  limitTitle: { fontSize: 15, fontWeight: '800' },
  limitText: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  actions: { gap: Spacing[2], marginTop: Spacing[2] },
});
