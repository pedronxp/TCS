import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import TicketScreen from '../app/(panel)/suporte/[id]';
import { supabase } from '../utils/supabase';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => false), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('../utils/useBottomTabPadding', () => ({ useBottomTabPadding: () => 0 }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ profile: null }) }));
jest.mock('../utils/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../components/ui', () => {
  const { Text } = require('react-native');
  return {
    AppHeader: ({ title, onBack }: { title: string; onBack: () => void }) =>
      <Text onPress={onBack}>{title}</Text>,
    Badge: () => null,
    Button: () => null,
    FormField: () => null,
    LoadingState: ({ message }: { message: string }) => <Text>{message}</Text>,
    ErrorState: ({ message }: { message: string }) => <Text>{message}</Text>,
    StateBanner: ({ title }: { title: string }) => <Text>{title}</Text>,
  };
});

it('permite sair quando o link não tem identificador', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  render(<TicketScreen />);
  expect(await screen.findByText('Chamado não encontrado.')).toBeTruthy();
  fireEvent.press(screen.getByText('Chamado'));
  expect(router.replace).toHaveBeenCalledWith('/(panel)/suporte');
  expect(supabase.from).not.toHaveBeenCalled();
});

it('exibe o chamado e mantém a volta quando apenas o histórico falha', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'ticket-1' });
  const single = jest.fn().mockResolvedValue({
    data: { id: 'ticket-1', public_code: 'TCS-1', subject: 'Assunto', description: 'Descrição original', status: 'open', created_at: '2026-01-01' },
    error: null,
  });
  jest.mocked(supabase.from).mockReturnValue({ select: () => ({ eq: () => ({ single }) }) } as never);
  jest.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'network' } } as never);
  render(<TicketScreen />);
  expect(await screen.findByText('Descrição original')).toBeTruthy();
  expect(screen.getByText('Histórico indisponível')).toBeTruthy();
  fireEvent.press(screen.getByText('TCS-1'));
  expect(router.replace).toHaveBeenCalledWith('/(panel)/suporte');
});
