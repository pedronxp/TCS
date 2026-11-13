import React from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ElectronicAcknowledgementScreen from '../app/(panel)/inspecoes/ciencia';

jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useLocalSearchParams: () => ({ documentId: 'document-1' }) }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-print', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24 }) }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ profile: { uid: 'author' } }) }));
jest.mock('../context/ConnectivityContext', () => ({ useConnectivity: () => ({ isOnlineReal: false }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock('../utils/documentAcknowledgementDatabase', () => ({
  getGeneratedDocument: () => ({ id: 'document-1', createdBy: 'author', documentType: 'report', documentVersion: 1, trainingMode: true, previewHtml: '<p>Documento</p>' }),
  listAcknowledgementEventsForDocument: () => [],
}));
jest.mock('../services/DocumentAcknowledgementService', () => ({}));
jest.mock('../services/SyncService', () => ({}));
jest.mock('../services/StorageService', () => ({}));
jest.mock('../utils/acknowledgementReceiptBuilder', () => ({}));
jest.mock('../components/SignaturePad', () => {
  const { View } = require('react-native');
  return { SignaturePad: (props: object) => <View testID="signature-pad" {...props} /> };
});
jest.mock('../components/ui', () => {
  const { Text } = require('react-native');
  return {
    FormField: jest.requireActual('../components/ui/FormField').FormField,
    AppHeader: () => null, Badge: () => null, Button: () => null,
    EmptyState: () => null, SectionHeader: () => null,
    StateBanner: ({ title }: { title: string }) => <Text>{title}</Text>,
  };
});

it('mantém rolagem e texto ao passar da assinatura para impossibilidade', async () => {
  render(<ElectronicAcknowledgementScreen />);
  const pad = await screen.findByTestId('signature-pad');
  fireEvent(pad, 'interactionChange', true);
  expect(screen.UNSAFE_getByType(ScrollView).props.scrollEnabled).toBe(false);
  fireEvent.press(screen.getByText('Impossibilidade'));
  expect(screen.UNSAFE_getByType(ScrollView).props.scrollEnabled).toBe(true);
  const relationship = screen.getByLabelText('Relação com o atendimento');
  fireEvent(relationship, 'focus', { nativeEvent: {} });
  fireEvent.changeText(relationship, 'Responsável pelo imóvel');
  expect(screen.getByLabelText('Relação com o atendimento')).toBe(relationship);
  expect(relationship.props.value).toBe('Responsável pelo imóvel');
  expect(screen.getByLabelText('Motivo')).toBeTruthy();
  expect(screen.queryByTestId('signature-pad')).toBeNull();
});

it('reserva espaço para o teclado e mantém o toque nos campos', async () => {
  render(<ElectronicAcknowledgementScreen />);
  await screen.findByTestId('signature-pad');
  expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
  expect(screen.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
});
