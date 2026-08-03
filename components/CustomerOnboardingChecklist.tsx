import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useConnectivity } from '../context/ConnectivityContext';
import {
  CUSTOMER_ONBOARDING_ITEMS,
  customerLifecycleMessage,
  getCustomerOnboardingContext,
  updateCustomerOnboardingItem,
  type CustomerOnboardingContext,
  type CustomerOnboardingItem,
} from '../services/CustomerOnboardingService';

export function CustomerOnboardingChecklist() {
  const { theme } = useTheme();
  const { isConnected } = useConnectivity();
  const [context, setContext] = useState<CustomerOnboardingContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isConnected) {
      setError('Conecte-se para atualizar as etapas da implantação.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setContext(await getCustomerOnboardingContext());
    } catch {
      setError('Não foi possível carregar as etapas da implantação.');
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const completeConfiguration = async () => {
    setUpdating(true);
    setError(null);
    try {
      setContext(await updateCustomerOnboardingItem('configuration'));
    } catch {
      setError('Não foi possível concluir a configuração agora. Tente novamente.');
    } finally {
      setUpdating(false);
    }
  };

  const checklist = context?.onboarding?.checklist;
  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}> 
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }
  if (error && !context) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}> 
        <Feather name={isConnected ? 'alert-circle' : 'wifi-off'} size={22} color="#EF4444" />
        <Text style={[styles.title, { color: theme.text }]}>Implantação indisponível</Text>
        <TouchableOpacity onPress={() => void load()} accessibilityRole="button">
          <Text style={styles.error}>{error} Toque para tentar novamente.</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!context?.onboarding || context.account_kind !== 'organization' || context.onboarding.progress_percent === 100) {
    return null;
  }

  const actionFor = (item: CustomerOnboardingItem) => {
    if (item === 'team') return () => router.push('/(panel)/admin/usuarios');
    if (item === 'configuration') return () => void completeConfiguration();
    if (item === 'first_operation') return () => router.push('/(panel)/inspecoes/dados-iniciais');
    return undefined;
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}> 
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: theme.primary }]}>PRIMEIROS PASSOS</Text>
          <Text style={[styles.title, { color: theme.text }]}>Implantação do município</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}> 
            {customerLifecycleMessage(context.lifecycle_state)}
          </Text>
        </View>
        <Text style={[styles.progress, { color: theme.primary }]}> 
          {context.onboarding.progress_percent ?? 0}%
        </Text>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: theme.iconBackground }]}> 
        <View
          style={[
            styles.progressFill,
            { backgroundColor: theme.primary, width: `${context.onboarding.progress_percent ?? 0}%` },
          ]}
        />
      </View>

      <View style={styles.items}>
        {CUSTOMER_ONBOARDING_ITEMS.map((item) => {
          const done = checklist?.[item.key] === true;
          const action = done ? undefined : actionFor(item.key);
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.item}
              disabled={!action || updating}
              onPress={action}
              accessibilityRole={action ? 'button' : undefined}
            >
              <Feather
                name={done ? 'check-circle' : 'circle'}
                size={19}
                color={done ? '#10B981' : theme.textSecondary}
              />
              <Text style={[styles.itemLabel, { color: done ? theme.textSecondary : theme.text }]}> 
                {item.label}
              </Text>
              {!done && action && <Feather name="chevron-right" size={17} color={theme.primary} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {updating && <ActivityIndicator color={theme.primary} />}
      {error && (
        <TouchableOpacity onPress={() => void load()}>
          <Text style={styles.error}>{error} Toque para tentar novamente.</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 22 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '800', marginTop: 3 },
  description: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  progress: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden', marginVertical: 16 },
  progressFill: { height: '100%', borderRadius: 4 },
  items: { gap: 3 },
  item: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemLabel: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  error: { color: '#EF4444', fontSize: 12, lineHeight: 18, marginTop: 10 },
});
