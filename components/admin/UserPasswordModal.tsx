import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

interface UserPasswordModalProps {
  changingPass: boolean;
  newPassword: string;
  onCancel: () => void;
  onChangePassword: () => void;
  onPasswordChange: (value: string) => void;
  userName?: string | null;
  visible: boolean;
}

export function UserPasswordModal({
  changingPass,
  newPassword,
  onCancel,
  onChangePassword,
  onPasswordChange,
  userName,
  visible,
}: UserPasswordModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const modalMaxHeight = Math.min(
    windowHeight * 0.82,
    windowHeight - insets.top - insets.bottom - 24
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!changingPass) {
          onCancel();
        }
      }}
    >
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View
          style={[
            styles.overlay,
            {
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                maxHeight: modalMaxHeight,
              },
            ]}
          >
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.surfaceHighlight }]}>
                <Feather name="key" size={24} color={theme.text} />
              </View>

              <Text style={[styles.title, { color: theme.text }]}>Redefinir senha</Text>
              <Text style={[styles.description, { color: theme.textSecondary }]}>
                Defina uma nova senha para o acesso de{' '}
                <Text style={styles.strongText}>{userName || 'usuário selecionado'}</Text>
              </Text>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceHighlight,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={newPassword}
                onChangeText={onPasswordChange}
                placeholder="Digite a nova senha"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                autoCapitalize="none"
                autoFocus
              />

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.secondaryButton, { backgroundColor: theme.surfaceHighlight }]}
                  onPress={onCancel}
                  disabled={changingPass}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: theme.text }]}
                  onPress={onChangePassword}
                  disabled={changingPass}
                >
                  {changingPass ? (
                    <ActivityIndicator color={theme.background} size="small" />
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: theme.background }]}>
                      Salvar
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 20,
    height: 64,
    justifyContent: 'center',
    marginBottom: 16,
    width: 64,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    height: 52,
    marginTop: 20,
    paddingHorizontal: 16,
    width: '100%',
  },
  keyboardRoot: {
    flex: 1,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontWeight: '700',
  },
  scrollContent: {
    alignItems: 'center',
    padding: 24,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  sheet: {
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 400,
    overflow: 'hidden',
    width: '100%',
  },
  strongText: {
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
});
