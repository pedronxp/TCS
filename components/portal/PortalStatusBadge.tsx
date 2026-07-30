import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PortalSemanticTokens } from '../../constants/PortalSemanticTokens';
import type { SubscriptionStatus } from '../../context/SubscriptionContext';
import { useTheme } from '../../context/ThemeContext';

type Status = SubscriptionStatus | 'none';

const presentations: Record<Status, {
  term: keyof typeof PortalSemanticTokens.stateTerms;
  tone: 'success' | 'warning' | 'danger' | 'information';
}> = {
  trial: { term: 'trial', tone: 'information' },
  active: { term: 'active', tone: 'success' },
  grace: { term: 'grace', tone: 'warning' },
  past_due: { term: 'pastDue', tone: 'warning' },
  canceled: { term: 'canceled', tone: 'danger' },
  expired: { term: 'expired', tone: 'danger' },
  none: { term: 'none', tone: 'danger' },
};

export interface PortalStatusBadgeProps {
  status?: SubscriptionStatus | null;
  cancelAtPeriodEnd?: boolean;
  label?: string;
}

export function PortalStatusBadge({
  status,
  cancelAtPeriodEnd = false,
  label,
}: PortalStatusBadgeProps) {
  const { isDark } = useTheme();
  const theme = PortalSemanticTokens[isDark ? 'dark' : 'light'];
  const presentation = cancelAtPeriodEnd && status
    ? { term: 'cancelAtPeriodEnd' as const, tone: 'warning' as const }
    : presentations[status ?? 'none'];
  const displayedLabel = label ?? PortalSemanticTokens.stateTerms[presentation.term];
  const foreground = theme[presentation.tone];
  const background = theme[`${presentation.tone}Surface`];

  return (
    <View
      accessible
      accessibilityLabel={`Status da assinatura: ${displayedLabel}`}
      style={[styles.badge, { backgroundColor: background }]}
    >
      <View style={[styles.dot, { backgroundColor: foreground }]} />
      <Text style={[styles.label, { color: foreground }]}>{displayedLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
  },
});
