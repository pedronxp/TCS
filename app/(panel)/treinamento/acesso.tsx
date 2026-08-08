import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, Button, Card, StateBanner } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { useTraining } from '../../../context/TrainingContext';
import { formatTrainingToken, trainingEntryMessage } from '../../../services/TrainingService';
import { Spacing, SpacingAlias } from '../../../constants/Spacing';

export default function TrainingAccessScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { enter } = useTraining();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (token.length !== 14) {
      setError('Informe o código completo da turma.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await enter({
        nome: profile?.name || 'Participante',
        token,
      });
      if (!result.ok) {
        setError(trainingEntryMessage(result));
        return;
      }
      router.replace('/(panel)/treinamento');
    } catch {
      setError('Não foi possível entrar no treinamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <AppHeader title="Treinamento" subtitle="Ambiente completo para contas autenticadas" onBack={() => router.back()} />
      <View style={styles.content}>
        <Card style={styles.card}>
          <View style={[styles.icon, { backgroundColor: theme.successLight }]}>
            <Feather name="book-open" size={24} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Entrar em uma turma</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Use o código fornecido pelo instrutor. As vistorias da turma não possuem o limite do preview público.</Text>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Código da turma</Text>
          <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
            <Feather name="key" size={19} color={theme.textSecondary} />
            <TextInput
              value={token}
              onChangeText={(value) => { setToken(formatTrainingToken(value)); setError(null); }}
              placeholder="XXXX-XXXX-XXXX"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              maxLength={14}
              style={[styles.input, { color: theme.text }]}
            />
          </View>
          {error && <StateBanner variant="danger" title="Acesso não concluído" description={error} />}
          <Button size="lg" fullWidth loading={loading} onPress={submit}>ENTRAR NO TREINAMENTO</Button>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing[5], width: '100%', maxWidth: 600, alignSelf: 'center' },
  card: { padding: Spacing[5], gap: Spacing[4] },
  icon: { width: 54, height: 54, borderRadius: SpacingAlias.radiusLg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '900' },
  subtitle: { fontSize: 14, lineHeight: 21 },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  inputRow: { minHeight: 58, borderWidth: 1, borderRadius: SpacingAlias.radiusMd, paddingHorizontal: Spacing[4], flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  input: { flex: 1, fontSize: 17, letterSpacing: 2, fontWeight: '700' },
});
