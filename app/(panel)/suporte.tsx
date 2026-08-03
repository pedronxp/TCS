import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../utils/supabase';
import { useBottomTabPadding } from '../../utils/useBottomTabPadding';
import { AppHeader, Button, FormField, StateBanner } from '../../components/ui';

export default function SuporteScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const subjectError = attempted && subject.trim().length < 5 ? 'Use pelo menos 5 caracteres.' : undefined;
  const descriptionError = attempted && description.trim().length < 10 ? 'Descreva o problema com pelo menos 10 caracteres.' : undefined;

  const submit = async () => {
    setAttempted(true);
    if (subject.trim().length < 5 || description.trim().length < 10) return;

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('open_support_ticket', {
        p_category: 'app',
        p_subject: subject.trim(),
        p_description: description.trim(),
        p_priority: 'normal',
      });
      if (error) throw error;
      Alert.alert(
        'Chamado aberto',
        `Protocolo ${data?.public_code || 'registrado'}. A equipe TCS analisará sua solicitação.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (error: any) {
      Alert.alert('Não foi possível abrir o chamado', error?.message || 'Verifique sua conexão e tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top }}>
        <AppHeader title="Suporte TCS" subtitle="Atendimento técnico e operacional" onBack={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: theme.secondary }]}>
            <Feather name="message-circle" size={24} color={theme.primary} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, { color: theme.text }]}>Como podemos ajudar?</Text>
            <Text style={[styles.heroDescription, { color: theme.textSecondary }]}>Envie o contexto do problema para facilitar a análise da equipe.</Text>
          </View>
        </View>

        <StateBanner
          title="Inclua detalhes úteis"
          description="Informe a tela, o que você tentou fazer e a mensagem apresentada. Não envie senhas nem códigos de acesso."
        />

        <View style={[styles.formCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <FormField
            label="Assunto"
            required
            value={subject}
            onChangeText={value => setSubject(value.slice(0, 120))}
            placeholder="Ex.: problema ao sincronizar vistoria"
            error={subjectError}
            helperText={`${subject.length}/120 caracteres`}
            returnKeyType="next"
          />
          <FormField
            label="Detalhes"
            required
            value={description}
            onChangeText={value => setDescription(value.slice(0, 2000))}
            placeholder="Descreva o que aconteceu, quando ocorreu e o resultado esperado."
            error={descriptionError}
            helperText={`${description.length}/2000 caracteres`}
            multiline
            inputStyle={styles.description}
          />
          <Button
            label="Abrir chamado"
            onPress={() => void submit()}
            loading={busy}
            fullWidth
            size="lg"
            iconLeft={<Feather name="send" size={18} color="#FFFFFF" />}
          />
        </View>

        <View style={[styles.protocolNote, { borderColor: theme.border }]}>
          <Feather name="file-text" size={18} color={theme.primary} />
          <Text style={[styles.protocolText, { color: theme.textSecondary }]}>Após o envio, você receberá um protocolo para acompanhar o atendimento.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  hero: { borderWidth: 1, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 19, fontWeight: '800' },
  heroDescription: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  formCard: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 18 },
  description: { minHeight: 150, paddingTop: 12, textAlignVertical: 'top' },
  protocolNote: { borderTopWidth: 1, paddingTop: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  protocolText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
