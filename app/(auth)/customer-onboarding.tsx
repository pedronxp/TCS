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
import { Button, Card } from '../../components/ui';
import { ProductIdentity } from '../../components/brand';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { useTheme } from '../../context/ThemeContext';
import {
  bootstrapIndividualCustomer,
  bootstrapMunicipalCustomer,
  customerLifecycleMessage,
  getCustomerOnboardingContext,
  recordCustomerOnboardingEvent,
  type CustomerOnboardingContext,
} from '../../services/CustomerOnboardingService';

const TERMS_VERSION = 'customer-terms-2026-08';
type AccountKind = 'individual' | 'organization';

export default function CustomerOnboardingScreen() {
  const { theme } = useTheme();
  const { isConnected } = useConnectivity();
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [context, setContext] = useState<CustomerOnboardingContext | null>(null);
  const [kind, setKind] = useState<AccountKind | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [municipalityName, setMunicipalityName] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [responsibleName, setResponsibleName] = useState(profile?.name ?? '');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContext = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextContext = await getCustomerOnboardingContext();
      setContext(nextContext);
      if (nextContext.account_kind === 'individual' || nextContext.account_kind === 'organization') {
        setKind(nextContext.account_kind);
      }
      void recordCustomerOnboardingEvent(nextContext.onboarding ? 'onboarding_resumed' : 'onboarding_viewed');
    } catch {
      setError(isConnected
        ? 'Não foi possível carregar seu onboarding. Tente novamente.'
        : 'Você está offline. Conecte-se para retomar o cadastro salvo na sua conta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, []);

  const finish = async () => {
    await refreshProfile();
    router.replace('/(panel)/dashboard');
  };

  const submitIndividual = async () => {
    if (!session || !termsAccepted) {
      setError('Aceite os termos para continuar.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      void recordCustomerOnboardingEvent('bootstrap_submitted');
      setContext(await bootstrapIndividualCustomer(session.user.id, TERMS_VERSION));
      await finish();
    } catch {
      setError('Não foi possível ativar o acesso individual. Revise os dados ou tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitMunicipal = async () => {
    if (!session || !termsAccepted) {
      setError('Aceite os termos para continuar.');
      return;
    }
    if (!displayName.trim() || !municipalityName.trim() || stateCode.trim().length !== 2 || !responsibleName.trim()) {
      setError('Preencha organização, município, UF e responsável.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      void recordCustomerOnboardingEvent('bootstrap_submitted');
      setContext(await bootstrapMunicipalCustomer(session.user.id, {
        displayName,
        municipalityName,
        stateCode,
        responsibleName,
        termsVersion: TERMS_VERSION,
      }));
      await finish();
    } catch (cause) {
      const duplicate = cause instanceof Error && cause.message.includes('municipality_onboarding_exists');
      setError(duplicate
        ? 'Esse município já possui onboarding. Solicite um convite ao administrador existente.'
        : 'Não foi possível criar o onboarding municipal. Revise os dados ou tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectKind = (nextKind: AccountKind) => {
    setKind(nextKind);
    setError(null);
    void recordCustomerOnboardingEvent('account_kind_selected');
    if (nextKind === 'organization') void recordCustomerOnboardingEvent('details_started');
  };

  const toggleTerms = () => {
    const accepted = !termsAccepted;
    setTermsAccepted(accepted);
    if (accepted) void recordCustomerOnboardingEvent('terms_accepted');
  };

  const individualEnabled = context?.features?.individual_bootstrap === true;
  const municipalEnabled = context?.features?.municipal_bootstrap === true;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ProductIdentity variant="compact" />
          <Text style={[styles.title, { color: theme.text }]}>Configure seu acesso</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}> 
            Sua identidade foi verificada. Agora escolha como você usará o TCS. Essa decisão fica salva na sua conta.
          </Text>

          {context?.lifecycle_state && (
            <Card>
              <Text style={[styles.choiceTitle, { color: theme.text }]}>Situação do cadastro</Text>
              <Text style={[styles.statusText, { color: theme.textSecondary }]}> 
                {customerLifecycleMessage(context.lifecycle_state)}
              </Text>
              {context.onboarding && (
                <Text style={[styles.progressText, { color: theme.primary }]}> 
                  {context.onboarding.completed_items ?? 0} de {context.onboarding.total_items ?? 0} etapas concluídas
                </Text>
              )}
            </Card>
          )}

          {loading ? (
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>Carregando opções...</Text>
          ) : (
            <View style={styles.choiceGrid}>
              <ChoiceCard
                title="Uso individual"
                description="Para profissional autônomo, sem equipe municipal."
                icon="user"
                selected={kind === 'individual'}
                disabled={!individualEnabled}
                onPress={() => selectKind('individual')}
              />
              <ChoiceCard
                title="Prefeitura ou município"
                description="Cria onboarding provisório e você como primeiro administrador."
                icon="users"
                selected={kind === 'organization'}
                disabled={!municipalEnabled}
                onPress={() => selectKind('organization')}
              />
            </View>
          )}

          {!loading && !individualEnabled && !municipalEnabled && (
            <Card>
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                O cadastro autônomo ainda está fechado para sua coorte. Se você recebeu um convite, volte ao login e use o token de acesso.
              </Text>
            </Card>
          )}

          {kind === 'organization' && municipalEnabled && (
            <View style={styles.form}>
              <Field label="Nome da organização" value={displayName} onChangeText={setDisplayName} placeholder="Prefeitura Municipal de..." />
              <Field label="Município" value={municipalityName} onChangeText={setMunicipalityName} placeholder="Município" />
              <Field label="UF" value={stateCode} onChangeText={value => setStateCode(value.toUpperCase().slice(0, 2))} placeholder="MG" />
              <Field label="Responsável" value={responsibleName} onChangeText={setResponsibleName} placeholder="Nome completo" />
            </View>
          )}

          {kind && (kind === 'individual' ? individualEnabled : municipalEnabled) && (
            <>
              <TouchableOpacity
                style={styles.termsRow}
                onPress={toggleTerms}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: termsAccepted }}
              >
                <Feather name={termsAccepted ? 'check-square' : 'square'} size={22} color={theme.primary} />
                <Text style={[styles.termsText, { color: theme.textSecondary }]}>
                  Li e aceito os termos de uso e privacidade ({TERMS_VERSION}).
                </Text>
              </TouchableOpacity>
              <Button
                variant="primary"
                loading={submitting}
                disabled={submitting || !termsAccepted}
                onPress={kind === 'individual' ? submitIndividual : submitMunicipal}
              >
                {kind === 'individual' ? 'Ativar acesso individual' : 'Iniciar onboarding municipal'}
              </Button>
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
          <TouchableOpacity onPress={loadContext} disabled={loading}>
            <Text style={[styles.link, { color: theme.primary }]}>Tentar novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut}>
            <Text style={[styles.link, { color: theme.textSecondary }]}>Sair desta conta</Text>
          </TouchableOpacity>
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
  disabled: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.choice,
        { backgroundColor: theme.surfaceHighlight, borderColor: props.selected ? theme.primary : theme.border },
        props.disabled && styles.disabled,
      ]}
      onPress={props.onPress}
      disabled={props.disabled}
    >
      <Feather name={props.icon} size={24} color={props.disabled ? theme.textSecondary : theme.primary} />
      <Text style={[styles.choiceTitle, { color: theme.text }]}>{props.title}</Text>
      <Text style={[styles.choiceDescription, { color: theme.textSecondary }]}>{props.description}</Text>
      {props.disabled && <Text style={[styles.unavailable, { color: theme.textSecondary }]}>Indisponível nesta fase</Text>}
    </TouchableOpacity>
  );
}

function Field(props: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{props.label}</Text>
      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
        value={props.value}
        placeholder={props.placeholder}
        placeholderTextColor={theme.textSecondary}
        onChangeText={props.onChangeText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 28, paddingVertical: 32, gap: 20 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  choiceGrid: { gap: 12 },
  choice: { borderWidth: 1.5, borderRadius: 16, padding: 18, gap: 7 },
  disabled: { opacity: 0.5 },
  choiceTitle: { fontSize: 17, fontWeight: '700' },
  choiceDescription: { fontSize: 13, lineHeight: 19 },
  unavailable: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  form: { gap: 14 },
  fieldGroup: { gap: 7 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, height: 54, fontSize: 15 },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  termsText: { flex: 1, fontSize: 13, lineHeight: 19 },
  statusText: { fontSize: 14, lineHeight: 21 },
  progressText: { fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 8 },
  errorText: { color: '#EF4444', fontSize: 14, lineHeight: 20 },
  link: { textAlign: 'center', fontSize: 14, fontWeight: '600', paddingVertical: 4 },
});
