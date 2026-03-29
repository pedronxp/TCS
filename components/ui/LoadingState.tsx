// components/ui/LoadingState.tsx
import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FontSize } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';

interface LoadingStateProps {
  /** Mensagem opcional abaixo do spinner */
  message?: string;
  /** 'full' ocupa toda a tela; 'inline' é compacto */
  mode?: 'full' | 'inline';
  style?: ViewStyle;
}

export const LoadingState = React.memo(function LoadingState({
  message,
  mode = 'full',
  style,
}: LoadingStateProps) {
  const { theme } = useTheme();

  if (mode === 'inline') {
    return (
      <View style={[styles.inline, style]}>
        <ActivityIndicator size="small" color={theme.primary} />
        {message ? (
          <Text style={[styles.messageInline, { color: theme.textSecondary }]}>
            {message}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.full, style]}>
      <ActivityIndicator size="large" color={theme.primary} />
      {message ? (
        <Text style={[styles.messageFull, { color: theme.textSecondary }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  full: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[3],  // 12
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],  // 8
    padding: Spacing[3],
  },
  messageFull: {
    fontSize: FontSize.base,  // 14
    textAlign: 'center',
  },
  messageInline: {
    fontSize: FontSize.sm,    // 12
  },
});
