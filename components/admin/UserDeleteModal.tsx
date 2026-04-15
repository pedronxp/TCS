import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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
  Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import {
  getUserDeletionImpactItems,
  hasUserDeletionImpact,
  UserDeletionImpact,
} from '../../utils/userDeletion';

interface ManagedUserLite {
  email?: string | null;
  municipio?: string | null;
  name: string;
  role: string;
}

interface UserDeleteModalProps {
  confirmDisabled?: boolean;
  deleteVistorias: boolean;
  deleting: boolean;
  impact: UserDeletionImpact;
  impactError?: string | null;
  loadingImpact: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onDeleteVistoriasChange: (value: boolean) => void;
  onReasonChange: (value: string) => void;
  reason: string;
  user: ManagedUserLite | null;
  visible: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agente',
  supervisor: 'Supervisor',
  admin: 'Admin',
  master_admin: 'Master',
};

export function UserDeleteModal({
  confirmDisabled = false,
  deleteVistorias,
  deleting,
  impact,
  impactError,
  loadingImpact,
  onCancel,
  onConfirm,
  onDeleteVistoriasChange,
  onReasonChange,
  reason,
  user,
  visible,
}: UserDeleteModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const impactItems = getUserDeletionImpactItems(impact);
  const hasImpact = hasUserDeletionImpact(impact);
  const keyboardVisible = keyboardHeight > 0;
  const availableHeight = Math.max(windowHeight - keyboardHeight, 320);
  const modalMaxHeight = useMemo(
    () =>
      Math.min(
        availableHeight * 0.9,
        availableHeight - insets.top - Math.max(insets.bottom, 12) - 24
      ),
    [availableHeight, insets.bottom, insets.top]
  );

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(Math.max(event.endCoordinates.height - insets.bottom, 0));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [insets.bottom, visible]);

  const handleReasonFocus = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!deleting) {
          onCancel();
        }
      }}
    >
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View
          style={[
            styles.overlay,
            {
              justifyContent: keyboardVisible ? 'flex-end' : 'center',
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 12) + (Platform.OS === 'android' ? keyboardHeight : 0),
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
              ref={scrollRef}
              bounces={false}
              contentContainerStyle={styles.scrollContent}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <Feather name="trash-2" size={24} color="#EF4444" />
              </View>

              <Text style={[styles.title, { color: theme.text }]}>Excluir usuário</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                A conta será removida do acesso do sistema. Use isso para usuários inúteis,
                duplicados ou de teste.
              </Text>

              {user && (
                <View
                  style={[
                    styles.userBox,
                    { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.userHeader}>
                    <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                      {user.name}
                    </Text>
                    <View style={[styles.roleBadge, { backgroundColor: `${theme.primary}18` }]}>
                      <Text style={[styles.roleText, { color: theme.primary }]}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Text>
                    </View>
                  </View>
                  {!!user.email && (
                    <Text style={[styles.userMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {user.email}
                    </Text>
                  )}
                  {!!user.municipio && (
                    <Text style={[styles.userMeta, { color: theme.textSecondary }]}>
                      {user.municipio}
                    </Text>
                  )}
                </View>
              )}

              <View
                style={[
                  styles.impactBox,
                  { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.impactTitle, { color: theme.text }]}>Impacto da exclusão</Text>

                {loadingImpact ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[styles.impactHint, { color: theme.textSecondary }]}>
                      Mapeando vínculos do usuário...
                    </Text>
                  </View>
                ) : impactError ? (
                  <Text style={[styles.impactHint, { color: '#F59E0B' }]}>
                    Não foi possível mapear todos os vínculos agora. A exclusão continuará
                    protegida pela regra do servidor.
                  </Text>
                ) : hasImpact ? (
                  <View style={styles.impactList}>
                    {impactItems.map((item) => (
                      <View key={item.key} style={styles.impactRow}>
                        <View style={[styles.impactDot, { backgroundColor: theme.primary }]} />
                        <Text style={[styles.impactText, { color: theme.textSecondary }]}>
                          {item.label}: {item.count}
                        </Text>
                      </View>
                    ))}
                    <Text style={[styles.impactHint, { color: theme.textSecondary }]}>
                      Vínculos operacionais são limpos; vistorias históricas permanecem para não
                      perder rastreabilidade.
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.impactHint, { color: theme.textSecondary }]}>
                    Nenhum vínculo operacional encontrado para essa conta.
                  </Text>
                )}
              </View>

              {!loadingImpact && impact.vistorias > 0 && (
                <View
                  style={[
                    styles.checkboxRow,
                    { backgroundColor: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.22)' },
                  ]}
                >
                  <View style={styles.checkboxInfo}>
                    <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                      Apagar vistorias do usuário
                    </Text>
                    <Text style={[styles.checkboxHint, { color: theme.textSecondary }]}>
                      {impact.vistorias} vistoria{impact.vistorias !== 1 ? 's' : ''} serão excluídas permanentemente
                    </Text>
                  </View>
                  <Switch
                    value={deleteVistorias}
                    onValueChange={onDeleteVistoriasChange}
                    disabled={deleting}
                    trackColor={{ false: theme.border, true: 'rgba(239,68,68,0.45)' }}
                    thumbColor={deleteVistorias ? '#EF4444' : theme.textSecondary}
                  />
                </View>
              )}

              <Text style={[styles.label, { color: theme.textSecondary }]}>Motivo da exclusão *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceHighlight,
                    borderColor: reason.trim() ? theme.primary : theme.border,
                    color: theme.text,
                  },
                ]}
                value={reason}
                onChangeText={onReasonChange}
                placeholder="Ex: conta de testes, usuário duplicado, cadastro inválido..."
                placeholderTextColor={theme.textSecondary}
                editable={!deleting}
                multiline
                maxLength={300}
                onFocus={handleReasonFocus}
                textAlignVertical="top"
              />
              <Text style={[styles.counter, { color: theme.textSecondary }]}>{reason.length}/300</Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.secondaryButton, { backgroundColor: theme.surfaceHighlight }]}
                  onPress={onCancel}
                  disabled={deleting}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dangerButton, { opacity: confirmDisabled ? 0.45 : 1 }]}
                  onPress={onConfirm}
                  disabled={confirmDisabled}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.dangerButtonText}>Confirmar exclusão</Text>
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
    marginTop: 18,
    width: '100%',
  },
  checkboxHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  checkboxInfo: {
    flex: 1,
    marginRight: 12,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  checkboxRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 14,
    padding: 14,
    width: '100%',
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 11,
    marginTop: 6,
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 14,
    flex: 1.4,
    height: 50,
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 60,
    justifyContent: 'center',
    marginBottom: 16,
    width: 60,
  },
  impactBox: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    padding: 14,
    width: '100%',
  },
  impactDot: {
    borderRadius: 4,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  impactHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  impactList: {
    gap: 8,
  },
  impactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  impactText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  impactTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderRadius: 14,
    borderWidth: 1.5,
    fontSize: 14,
    marginTop: 8,
    minHeight: 96,
    padding: 14,
    width: '100%',
  },
  keyboardRoot: {
    flex: 1,
  },
  label: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 18,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  roleText: {
    fontSize: 11,
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
    fontSize: 14,
    fontWeight: '600',
  },
  sheet: {
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 440,
    overflow: 'hidden',
    width: '100%',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  userBox: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    padding: 14,
    width: '100%',
  },
  userHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  userMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  userName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
});
