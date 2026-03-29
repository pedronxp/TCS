// components/ui/ErrorState.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  /** Label do botão de retry */
  retryLabel?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export const ErrorState = React.memo(function ErrorState({
  title = 'Algo deu errado',
  message = 'Não foi possível carregar os dados.',
  retryLabel = 'Tentar novamente',
  onRetry,
  style,
}: ErrorStateProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.errorLight }]}>
        <Feather name="alert-circle" size={32} color={theme.error} />
      </View>

      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

      <Text style={[styles.message, { color: theme.textSecondary }]}>
        {message}
      </Text>

      {onRetry ? (
        <Button
          label={retryLabel}
          onPress={onRetry}
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
    padding: Spacing[6],   // 24
    gap: Spacing[3],       // 12
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.5,
  },
  button: {
    marginTop: Spacing[2],
  },
});
