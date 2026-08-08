import React, { useEffect, useState } from 'react';
import {
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
import { Button, Card, StateBanner } from '../../components/ui';
import { ProductIdentity } from '../../components/brand';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { useTheme } from '../../context/ThemeContext';
import {
  acceptMunicipalCustomerInvite,
  bootstrapIndividualCustomer,
  getCustomerOnboardingContext,
  recordCustomerOnboardingEvent,
  type CustomerOnboardingContext,
} from '../../services/CustomerOnboardingService';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

const TERMS_VERSION = 'customer-terms-2026-08';
type AccountKind = 'individual' | 'municipal';

const inviteReasons: Record<string, string> = {
  invalid: 'Convite inválido. Confira o código recebido.',
  expired: 'Este convite expirou. Solicite outro à prefeitura.',
  already_used: 'Este convite já foi utilizado.',
  membership_conflict: 'Esta conta já pertence a uma organização.',
  subscription_inactive: 'A operação municipal não está ativa.',
  limit_reached: 'A organização atingiu o limite de usuários.',
};

export default function CustomerOnboardingScreen() {
  const { theme } = useTheme();
  const { isConnected } = useConnectivity();
  const { session, refreshProfile, signOut } = useAuth();
  const [context, setContext] = useState<CustomerOnboardingContext | null>(null);
  const [kind, setKind] = useState<AccountKind>('individual');
  const [inviteToken, setInviteToken] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCustomerOnboardingContext()
      .then((next) => {
        setContext(next);
        void recordCustomerOnboardingEvent(next.onboarding ? 'onboarding_resumed' : 'onboarding_viewed');
      })
      .catch(() => setError(isConnected
        ? 'Não foi possível carregar as opções de cadastro.'
        : 'Conecte-se à internet para concluir o cadastro.'))
      .finally(() => setLoading(false));
  }, [isConnected]);

  const finish = async () => {
    await refreshProfile();
    router.replace('/(panel)/dashboard');
  };

  const submit = async () => {
    if (!session || !termsAccepted) {
      setError('Aceite os termos para continuar.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      void recordCustomerOnboardingEvent('bootstrap_submitted');
      if (kind === 'individual') {
        await bootstrapIndividualCustomer(session.user.id, TERMS_VERSION);
      } else {
        const result = await acceptMunicipalCustomerInvite(inviteToken);
        if (!result.accepted) {
          setError(inviteReasons[result.reason || 'invalid'] || 'Não foi possível aceitar este convite.');
          return;
        }
      }
      await finish();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.toLowerCase() : '';
      setError(message.includes('email_mismatch')
        ? 'O convite foi emitido para outro e-mail. Entre com a conta correta.'
        : 'Não foi possível concluir o cadastro agora. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const individualEnabled = context?.features?.individual_bootstrap !== false;
  const canSubmit = termsAccepted
    && !loading
    && (kind === 'individual' ? individualEnabled : inviteToken.length === 14);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ProductIdentity variant="compact" />
          <View style={styles.heading}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>ÚLTIMA ETAPA</Text>
            <Text style={[styles.title, { color: theme.text }]}>Concluir cadastro</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Sua conta Google já foi verificada. Agora informe apenas o tipo de acesso.</Text>
          </View>

          <View style={styles.choiceGrid}>
            <ChoiceCard
              title="Conta profissional"
              description="Uso individual, sem token municipal."
              icon="user"
              selected={kind === 'individual'}
              onPress={() => { setKind('individual'); setError(null); }}
            />
            <ChoiceCard
              title="Acesso municipal"
              description="Para quem recebeu convite de uma prefeitura."
              icon="briefcase"
              selected={kind === 'municipal'}
              onPress={() => { setKind('municipal'); setError(null); }}
            />
          </View>

          {kind === 'municipal' && (
            <Card style={styles.inviteCard}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Convite municipal</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="key" size={19} color={theme.textSecondary} />
                <TextInput
                  value={inviteToken}
                  onChangeText={(value) => {
                    const raw = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12);
                    setInviteToken((raw.match(/.{1,4}/g) || []).join('-'));
                    setError(null);
                  }}
                  placeholder="XXXX-XXXX-XXXX"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="characters"
                  maxLength={14}
                  style={[styles.input, { color: theme.text }]}
                />
              </View>
            </Card>
          )}

          {!individualEnabled && kind === 'individual' && (
            <StateBanner variant="warning" title="Cadastro individual indisponível" description="Use um convite municipal ou fale com o suporte." />
          )}
          {error && <StateBanner variant="danger" title="Cadastro não concluído" description={error} />}

          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => {
              setTermsAccepted((accepted) => !accepted);
              if (!termsAccepted) void recordCustomerOnboardingEvent('terms_accepted');
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: termsAccepted }}
          >
            <Feather name={termsAccepted ? 'check-square' : 'square'} size={22} color={theme.primary} />
            <Text style={[styles.termsText, { color: theme.textSecondary }]}>Li e aceito os termos de uso e privacidade.</Text>
          </TouchableOpacity>

          <Button variant="primary" size="lg" fullWidth loading={submitting} disabled={!canSubmit || submitting} onPress={submit}>
            {kind === 'individual' ? 'CRIAR CONTA PROFISSIONAL' : 'ATIVAR ACESSO MUNICIPAL'}
          </Button>
          <Button variant="ghost" fullWidth onPress={signOut}>Usar outra conta</Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ChoiceCard(props: {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.choice, { backgroundColor: theme.surfaceHighlight, borderColor: props.selected ? theme.primary : theme.border }]}
      onPress={props.onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: props.selected }}
    >
      <View style={[styles.choiceIcon, { backgroundColor: props.selected ? theme.successLight : theme.surface }]}>
        <Feather name={props.icon} size={21} color={theme.primary} />
      </View>
      <View style={styles.choiceCopy}>
        <Text style={[styles.choiceTitle, { color: theme.text }]}>{props.title}</Text>
        <Text style={[styles.choiceDescription, { color: theme.textSecondary }]}>{props.description}</Text>
      </View>
      <Feather name={props.selected ? 'check-circle' : 'circle'} size={20} color={props.selected ? theme.primary : theme.border} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing[6], paddingVertical: Spacing[6], gap: Spacing[5], width: '100%', maxWidth: 620, alignSelf: 'center' },
  heading: { gap: Spacing[2] },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  title: { fontSize: 31, lineHeight: 38, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  choiceGrid: { gap: Spacing[3] },
  choice: { minHeight: 84, borderWidth: 1.5, borderRadius: SpacingAlias.radiusLg, padding: Spacing[3], flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  choiceIcon: { width: 44, height: 44, borderRadius: SpacingAlias.radiusMd, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1 },
  choiceTitle: { fontSize: 16, fontWeight: '800' },
  choiceDescription: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  inviteCard: { padding: Spacing[4], gap: Spacing[3] },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  inputRow: { minHeight: 58, borderWidth: 1, borderRadius: SpacingAlias.radiusMd, paddingHorizontal: Spacing[4], flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  input: { flex: 1, fontSize: 17, letterSpacing: 2, fontWeight: '700' },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  termsText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
