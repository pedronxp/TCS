import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductIdentity } from '../../components/brand';
import { Button, Card } from '../../components/ui';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

export default function TrainingRequiresAccountScreen() {
  const { theme } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <ProductIdentity variant="compact" />
        <Card style={styles.card}>
          <View style={[styles.icon, { backgroundColor: theme.successLight }]}>
            <Feather name="book-open" size={27} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Treinamento dentro da conta</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Entre no aplicativo e abra Módulos → Treinamento para usar o código da turma sem limite de preview.</Text>
          <Button size="lg" fullWidth onPress={() => router.replace('/(auth)/login')}>ENTRAR NO SISTEMA</Button>
          <Button variant="secondary" fullWidth onPress={() => router.replace('/(auth)/preview')}>EXPERIMENTAR O PREVIEW</Button>
          <Button variant="ghost" fullWidth onPress={() => router.replace('/(auth)')}>Voltar</Button>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: Spacing[6], width: '100%', maxWidth: 580, alignSelf: 'center' },
  card: { marginTop: Spacing[6], padding: Spacing[5], gap: Spacing[4] },
  icon: { width: 58, height: 58, borderRadius: SpacingAlias.radiusLg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 27, lineHeight: 34, fontWeight: '900' },
  subtitle: { fontSize: 15, lineHeight: 23, marginBottom: Spacing[2] },
});
