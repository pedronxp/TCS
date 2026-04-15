import React from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { render } from '@testing-library/react-native';
import { UserPasswordModal } from '../admin/UserPasswordModal';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Feather: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      background: '#111827',
      border: '#374151',
      text: '#F9FAFB',
      textSecondary: '#9CA3AF',
      surfaceHighlight: '#1F2937',
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 20, left: 0, right: 0 }),
}));

describe('UserPasswordModal', () => {
  it('usa teclado adaptativo e conteúdo rolável para a redefinição de senha', () => {
    const { UNSAFE_getByType } = render(
      <UserPasswordModal
        visible
        changingPass={false}
        newPassword=""
        onCancel={jest.fn()}
        onChangePassword={jest.fn()}
        onPasswordChange={jest.fn()}
        userName="Usuário Teste"
      />
    );

    expect(UNSAFE_getByType(KeyboardAvoidingView)).toBeTruthy();
    expect(UNSAFE_getByType(ScrollView)).toBeTruthy();
  });
});
