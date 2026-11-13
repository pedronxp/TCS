import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import QeQueue from '../app/(panel)/qe';
import { supabase } from '../utils/supabase';
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => false }, useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]) }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('../utils/useBottomTabPadding', () => ({ useBottomTabPadding: () => 0 }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock('../utils/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('../components/ui', () => {
  const { Text } = require('react-native');
  return { AppHeader: ({ title, onBack }: any) => <Text onPress={onBack}>{title}</Text>, Badge: () => null,
    LoadingState: ({ message }: any) => <Text>{message}</Text>, ErrorState: ({ message }: any) => <Text>{message}</Text>,
    EmptyState: ({ description }: any) => <Text>{description}</Text> };
});
beforeEach(() => jest.clearAllMocks());
it('does not claim unsynchronized or out-of-scope inspections were reviewed', async () => {
  jest.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);
  render(<QeQueue />);
  expect(await screen.findByText(/Nenhuma vistoria pendente disponível para seu perfil/)).toBeTruthy();
});
it('preserves an exit when the server rejects the queue query', async () => {
  jest.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'network' } } as never);
  render(<QeQueue />);
  expect(await screen.findByText('Não foi possível carregar a fila de qualidade.')).toBeTruthy();
  fireEvent.press(screen.getByText('Revisão de qualidade'));
  expect(router.replace).toHaveBeenCalledWith('/(panel)/dashboard');
});
