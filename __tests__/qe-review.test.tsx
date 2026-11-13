import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import QeReview from '../app/(panel)/qe/[id]';
import { supabase } from '../utils/supabase';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useLocalSearchParams: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('../utils/useBottomTabPadding', () => ({ useBottomTabPadding: () => 0 }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock('../utils/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../services/StorageService', () => ({ getSignedUrl: jest.fn(async () => 'https://storage.example.test/signed-photo.jpg') }));
jest.mock('../components/ui', () => {
  const { Text } = require('react-native');
  return {
    AppHeader: ({ title, onBack }: any) => <Text onPress={onBack}>{title}</Text>,
    Badge: () => null, FormField: () => null, OptionSheet: () => null,
    LoadingState: ({ message }: any) => <Text>{message}</Text>,
    ErrorState: ({ message }: any) => <Text>{message}</Text>,
    StateBanner: ({ title }: any) => <Text>{title}</Text>,
  };
});

beforeEach(() => { jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

it('keeps an exit available when the review identifier is missing', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  render(<QeReview />);
  expect(await screen.findByText(/Identificador da revisão não informado/)).toBeTruthy();
  fireEvent.press(screen.getByText('Revisar vistoria'));
  expect(router.replace).toHaveBeenCalledWith('/(panel)/qe');
  expect(supabase.from).not.toHaveBeenCalled();
});

it('returns to the queue after persisting approval without waiting for alert OK and prevents duplicate submission', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'review-1' });
  jest.mocked(supabase.from).mockImplementation((table: string) => ({ select: () => ({ eq: () => ({ single: async () => ({
    data: table === 'revisoes_qe' ? { id: 'review-1', vistoria_id: 'inspection-1', ciclo: 1, status: 'pendente' } : { id: 'inspection-1', endereco: 'Local', fotoUrl: 'vistorias:photo.jpg', fotosUrls: [] }, error: null,
  }) }) }) }) as never);
  let finish!: (value: any) => void;
  jest.mocked(supabase.rpc).mockReturnValue(new Promise(resolve => { finish = resolve; }) as never);
  render(<QeReview />);
  const approve = await screen.findByText('Aprovar');
  expect(screen.getByLabelText('Foto 1 da vistoria').props.source.uri).toBe('https://storage.example.test/signed-photo.jpg');
  fireEvent.press(approve);
  fireEvent.press(approve);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
  finish({ error: null });
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(panel)/qe'));
  expect(Alert.alert).toHaveBeenCalledWith('Vistoria aprovada', expect.any(String));
});
