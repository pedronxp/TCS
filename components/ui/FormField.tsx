import React, { forwardRef, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { ComponentSize, Spacing, SpacingAlias } from '../../constants/Spacing';

export interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField({
  label,
  error,
  helperText,
  required = false,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  editable = true,
  ...inputProps
}, ref) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const helperId = `${inputProps.testID ?? label}-support`;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.label, { color: theme.text }]}>
        {label}{required ? <Text style={{ color: theme.error }}> *</Text> : null}
      </Text>
      <TextInput
        ref={ref}
        {...inputProps}
        editable={editable}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor={theme.muted}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        accessibilityHint={error ?? helperText}
        accessibilityState={{ disabled: !editable }}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: editable ? theme.surface : theme.mutedBackground,
            borderColor: error ? theme.error : focused ? theme.primary : theme.border,
            opacity: editable ? 1 : theme.disabledOpacity,
          },
          inputProps.multiline && styles.multiline,
          inputStyle,
        ]}
      />
      {error || helperText ? (
        <Text
          nativeID={helperId}
          style={[styles.support, { color: error ? theme.error : theme.textSecondary }]}
        >
          {error ?? helperText}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: Spacing[2] },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  input: {
    minHeight: ComponentSize.input,
    borderWidth: 1,
    borderRadius: SpacingAlias.radiusMd,
    paddingHorizontal: SpacingAlias.inputPadding,
    paddingVertical: Spacing[2],
    fontSize: FontSize.base,
  },
  multiline: { minHeight: 112, textAlignVertical: 'top' },
  support: { fontSize: FontSize.xs, lineHeight: 16 },
});
