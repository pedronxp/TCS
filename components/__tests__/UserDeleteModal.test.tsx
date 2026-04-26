import React from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { render } from '@testing-library/react-native';
import { UserDeleteModal } from '../admin/UserDeleteModal';

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
      primary: '#3B82F6',
      surfaceHighlight: '#1F2937',
      text: '#F9FAFB',
      textSecondary: '#9CA3AF',
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 10, bottom: 20, left: 0, right: 0 }),
}));

describe('UserDeleteModal', () => {
  it('usa teclado adaptativo e conteúdo rolável para telas menores', () => {
    const { UNSAFE_getByType } = render(
      <UserDeleteModal
        visible
        user={{
          name: 'Usuário Teste',
          role: 'agent',
          email: 'teste@example.com',
          municipio: 'Campinas',
        }}
        reason=""
        onReasonChange={jest.fn()}
        impact={{
          vistorias: 0,
          agendamentosCriados: 0,
          agendamentosComoAgente: 0,
          atribuicoesComoSupervisor: 0,
          atribuicoesComoAgente: 0,
        }}
        impactError={null}
        loadingImpact={false}
        deleting={false}
        deleteVistorias={false}
        onDeleteVistoriasChange={jest.fn()}
        confirmDisabled
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

    expect(UNSAFE_getByType(KeyboardAvoidingView)).toBeTruthy();
    expect(UNSAFE_getByType(ScrollView)).toBeTruthy();
  });
});
