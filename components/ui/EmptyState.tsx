// components/ui/EmptyState.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';
import { Button } from './Button';

interface EmptyStateProps {
  /** Nome do ícone Feather */
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description?: string;
  /** Label do botão de ação primária */
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState = React.memo(function EmptyState({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.surfaceVariant }]}>
        <Feather name={icon} size={32} color={theme.muted} />
      </View>

      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

      {description ? (
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          size="sm"
          style={styles.button}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],    // 24
    gap: Spacing[3],        // 12
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],  // 4
  },
  title: {
    fontSize: FontSize.lg,         // 18
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  description: {
    fontSize: FontSize.base,  // 14
    textAlign: 'center',
    lineHeight: FontSize.base * 1.5,
  },
  button: {
    marginTop: Spacing[2],  // 8
  },
});
