import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui/Button';
import { formatTrainingToken } from '../../services/TrainingService';

export default function TreinamentoEntryScreen() {
  const { theme } = useTheme();
  const [nome, setNome] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const voltar = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(auth)');
  };

  const entrar = () => {
    const nomeTrim = nome.trim();
    const tokenTrim = token.trim().toUpperCase();
    if (nomeTrim.length < 3) {
      setError('Informe seu nome para acessar o treinamento.');
      return;
    }
    if (tokenTrim.length < 14) {
      setError('Informe o token completo da turma.');
      return;
    }
    setError(null);
    router.push({
      pathname: '/(auth)/treinamento-loading',
      params: { nome: nomeTrim, token: tokenTrim },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
            onPress={voltar}
          >
            <Feather name="arrow-left" size={22} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={styles.hero}>
            <View style={[styles.logoFrame, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
              <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <View style={styles.heroBadge}>
              <Feather name="book-open" size={13} color="#10B981" />
              <Text style={styles.heroBadgeText}>Modo treinamento</Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Treinamento</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Informe seu nome e o token da turma para iniciar o ambiente de aula.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Nome completo</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="user" size={19} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Seu nome"
                  placeholderTextColor={theme.textSecondary}
                  value={nome}
                  onChangeText={setNome}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Token da turma</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="key" size={19} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text, letterSpacing: 2 }]}
                  placeholder="XXXX-XXXX-XXXX"
                  placeholderTextColor={theme.textSecondary}
                  value={token}
                  onChangeText={t => {
                    setToken(formatTrainingToken(t));
                    setError(null);
                  }}
                  autoCapitalize="characters"
                  maxLength={14}
                />
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              label="Entrar no Treinamento"
              onPress={entrar}
              size="lg"
              iconLeft={<Feather name="log-in" size={18} color="#FFF" />}
            />

            <Text style={[styles.footnote, { color: theme.textSecondary }]}>
              Os relatórios e vistorias deste modo ficam salvos localmente neste aparelho.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 26, paddingTop: 18, paddingBottom: 40 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 34,
  },
  hero: { alignItems: 'center', marginBottom: 32 },
  logoFrame: {
    width: 88,
    height: 88,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logo: { width: 66, height: 66 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(16,185,129,0.10)',
    marginBottom: 12,
  },
  heroBadgeText: { color: '#10B981', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: 34, fontWeight: '900' },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center', maxWidth: 310 },
  form: { gap: 22 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: 62, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.22)',
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: '#EF4444', fontSize: 13, flex: 1, lineHeight: 18 },
  footnote: { fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8 },
});
