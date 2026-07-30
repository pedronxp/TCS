import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PortalSemanticTokens } from '../../constants/PortalSemanticTokens';
import { useTheme } from '../../context/ThemeContext';

type StateKind = 'loading' | 'empty' | 'error' | 'permissionDenied' | 'planLocked';

const defaults: Record<StateKind, {
  icon: keyof typeof Feather.glyphMap;
  term: keyof typeof PortalSemanticTokens.stateTerms;
  tone: 'information' | 'warning' | 'danger';
}> = {
  loading: { icon: 'loader', term: 'loading', tone: 'information' },
  empty: { icon: 'inbox', term: 'empty', tone: 'information' },
  error: { icon: 'alert-triangle', term: 'retry', tone: 'danger' },
  permissionDenied: { icon: 'shield-off', term: 'permissionDenied', tone: 'warning' },
  planLocked: { icon: 'lock', term: 'planLocked', tone: 'warning' },
};

export interface PortalStateCardProps {
  kind: StateKind;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function PortalStateCard({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: PortalStateCardProps) {
  const { isDark } = useTheme();
  const theme = PortalSemanticTokens[isDark ? 'dark' : 'light'];
  const presentation = defaults[kind];
  const foreground = theme[presentation.tone];
  const background = theme[`${presentation.tone}Surface`];
  const displayedTitle = title ?? PortalSemanticTokens.stateTerms[presentation.term];

  return (
    <View
      accessible={kind === 'loading'}
      accessibilityLabel={kind === 'loading' ? displayedTitle : undefined}
      accessibilityState={kind === 'loading' ? { busy: true } : undefined}
      style={[
        styles.card,
        compact && styles.compact,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: background }]}>
        {kind === 'loading'
          ? <ActivityIndicator color={foreground} />
          : <Feather name={presentation.icon} size={20} color={foreground} />}
      </View>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.foreground }]}>
          {displayedTitle}
        </Text>
        {description ? (
          <Text style={[styles.description, { color: theme.mutedForeground }]}>
            {description}
          </Text>
        ) : null}
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: theme.primary, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Text style={[styles.actionLabel, { color: theme.onPrimary }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  compact: {
    padding: 14,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  action: {
    minHeight: 46,
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
});
