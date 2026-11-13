import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductIdentity } from '../../components/brand';
import { Button, Card, FormField, StateBanner } from '../../components/ui';
import { useTheme } from '../../context/ThemeContext';
import { useTraining } from '../../context/TrainingContext';
import { formatTrainingToken, trainingEntryMessage } from '../../services/TrainingService';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

export default function PublicTrainingScreen() {
  const { theme } = useTheme();
  const { enter, loading: initializing } = useTraining();
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const tokenInput = useRef<React.ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    if (submitting.current || initializing) return;
    if (!name.trim()) {
      setError('Informe seu nome para entrar na turma.');
      return;
    }
    if (token.length !== 14) {
      setError('Informe o código completo da turma.');
      return;
    }
    submitting.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await enter({ nome: name.trim(), token });
      if (!result.ok) {
        setError(trainingEntryMessage(result));
        return;
      }
      router.replace('/(panel)/treinamento');
    } catch {
      setError('Não foi possível entrar no treinamento. Tente novamente.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ProductIdentity variant="compact" />
          <Card style={styles.card}>
            <View style={[styles.icon, { backgroundColor: theme.successLight }]}>
              <Feather name="book-open" size={27} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Sala de treinamento</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Entre com seu nome e o código fornecido pelo instrutor, sem criar conta. O acesso segue o prazo e as vagas da turma.</Text>
            <FormField
              label="Seu nome"
              value={name}
              onChangeText={(value) => { setName(value); setError(null); }}
              placeholder="Como você se chama?"
              autoCapitalize="words"
              autoComplete="name"
              maxLength={120}
              returnKeyType="next"
              onSubmitEditing={() => tokenInput.current?.focus()}
              editable={!loading}
            />
            <FormField
              ref={tokenInput}
              label="Código da turma"
              value={token}
              onChangeText={(value) => { setToken(formatTrainingToken(value)); setError(null); }}
              placeholder="XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={14}
              returnKeyType="go"
              onSubmitEditing={submit}
              editable={!loading}
            />
            {error && <StateBanner variant="danger" title="Acesso não concluído" description={error} />}
            <Button size="lg" fullWidth loading={loading} disabled={initializing} onPress={submit}>ENTRAR NO TREINAMENTO</Button>
            <Button variant="ghost" fullWidth disabled={loading} onPress={() => router.replace('/(auth)')}>Voltar</Button>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing[6], width: '100%', maxWidth: 580, alignSelf: 'center' },
  card: { marginTop: Spacing[6], padding: Spacing[5], gap: Spacing[4] },
  icon: { width: 58, height: 58, borderRadius: SpacingAlias.radiusLg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 27, lineHeight: 34, fontWeight: '900' },
  subtitle: { fontSize: 15, lineHeight: 23, marginBottom: Spacing[2] },
});
