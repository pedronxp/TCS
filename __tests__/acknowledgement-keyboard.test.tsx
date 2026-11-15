import React from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Switch } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ElectronicAcknowledgementScreen from '../app/(panel)/inspecoes/ciencia';
import { createAcknowledgementEvent } from '../services/DocumentAcknowledgementService';
import { listAcknowledgementEventsForDocument } from '../utils/documentAcknowledgementDatabase';
import { syncPendentes } from '../services/SyncService';

let mockOnline = false;
let mockTraining = false;

jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useLocalSearchParams: () => ({ documentId: 'document-1' }) }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-print', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24 }) }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ profile: mockTraining ? null : { uid: 'author' } }) }));
jest.mock('../context/TrainingContext', () => ({ useTraining: () => ({ isTrainingActive: mockTraining, trainingProfile: mockTraining ? { uid: 'training:participant' } : null }) }));
jest.mock('../context/ConnectivityContext', () => ({ useConnectivity: () => ({ isOnlineReal: mockOnline }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: {} }) }));
jest.mock('../utils/documentAcknowledgementDatabase', () => ({
  getGeneratedDocument: () => ({ id: 'document-1', createdBy: mockTraining ? 'training:participant' : 'author', documentType: 'report', documentVersion: 1, trainingMode: true, previewHtml: '<p>Documento</p>' }),
  listAcknowledgementEventsForDocument: jest.fn(() => []),
  retryAcknowledgementEvent: jest.fn(),
  getAcknowledgementEvent: jest.fn(),
}));
jest.mock('../services/DocumentAcknowledgementService', () => ({
  createAcknowledgementEvent: jest.fn(),
  fetchRemoteAcknowledgementHistory: jest.fn(async () => []),
}));
jest.mock('../services/SyncService', () => ({ syncPendentes: jest.fn() }));
jest.mock('../services/StorageService', () => ({}));
jest.mock('../utils/acknowledgementReceiptBuilder', () => ({}));
jest.mock('../components/SignaturePad', () => {
  const { View } = require('react-native');
  return { SignaturePad: (props: object) => <View testID="signature-pad" {...props} /> };
});
jest.mock('../components/ui', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return {
    FormField: jest.requireActual('../components/ui/FormField').FormField,
    AppHeader: () => null, Badge: () => null,
    Button: ({ label, onPress, disabled, loading }: any) => (
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={disabled || loading} onPress={onPress}>
        <Text>{label}</Text>
      </TouchableOpacity>
    ),
    EmptyState: () => null, SectionHeader: () => null,
    StateBanner: ({ title }: { title: string }) => <Text>{title}</Text>,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = false;
  mockTraining = false;
  jest.mocked(listAcknowledgementEventsForDocument).mockReturnValue([]);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const strokes = [{ points: [{ x: 1, y: 1 }, { x: 3, y: 5 }] }];

it('registra ciência local para o participante sem login', async () => {
  mockTraining = true;
  jest.mocked(createAcknowledgementEvent).mockResolvedValueOnce({ id: 'training-event' } as Awaited<ReturnType<typeof createAcknowledgementEvent>>);
  render(<ElectronicAcknowledgementScreen />);
  const pad = await screen.findByTestId('signature-pad');
  fireEvent.changeText(screen.getByLabelText('Nome do destinatário'), 'Pessoa de teste');
  fireEvent(pad, 'change', strokes);
  fireEvent(screen.UNSAFE_getAllByType(Switch)[0], 'valueChange', true);
  await act(async () => fireEvent.press(screen.getByText('Registrar resultado')));
  expect(createAcknowledgementEvent).toHaveBeenCalledWith(expect.objectContaining({
    createdBy: 'training:participant',
    trainingMode: true,
  }));
  expect(syncPendentes).not.toHaveBeenCalled();
});

it.each(['', '   ', 'M'])('mostra o erro do nome inválido %j e revela o campo sem perder a assinatura nem chamar o serviço', async (name) => {
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
  render(<ElectronicAcknowledgementScreen />);
  const pad = await screen.findByTestId('signature-pad');
  fireEvent(pad, 'change', strokes);
  fireEvent.changeText(screen.getByLabelText('Nome do destinatário'), name);
  fireEvent(screen.getByTestId('recipient-name-field'), 'layout', { nativeEvent: { layout: { y: 650 } } });
  fireEvent.press(screen.getByText('Registrar resultado'));
  expect(screen.getByLabelText('Nome do destinatário').props.accessibilityHint).toMatch(/nome/i);
  expect(screen.getByText('Informe o nome do destinatário.')).toBeTruthy();
  expect(scrollTo).toHaveBeenCalledWith({ y: 634, animated: true });
  expect(createAcknowledgementEvent).not.toHaveBeenCalled();
  expect(syncPendentes).not.toHaveBeenCalled();
  expect(screen.getByTestId('signature-pad').props.value).toEqual(strokes);
  fireEvent.changeText(screen.getByLabelText('Nome do destinatário'), 'Maria Silva');
  expect(screen.queryByText('Informe o nome do destinatário.')).toBeNull();
});

it.each(['', '  ', 'M'])('impede relação inválida %j e mantém os demais dados para correção', async (relationship) => {
  render(<ElectronicAcknowledgementScreen />);
  await screen.findByTestId('signature-pad');
  fireEvent.changeText(screen.getByLabelText('Nome do destinatário'), 'Maria Silva');
  fireEvent.changeText(screen.getByLabelText('Relação com o atendimento'), relationship);
  fireEvent.press(screen.getByText('Registrar resultado'));
  expect(screen.getByText('Informe a relação do destinatário com o atendimento.')).toBeTruthy();
  expect(screen.getByLabelText('Nome do destinatário').props.value).toBe('Maria Silva');
  expect(createAcknowledgementEvent).not.toHaveBeenCalled();
});

it('preserva os dados e libera nova tentativa quando o registro falha', async () => {
  jest.mocked(createAcknowledgementEvent).mockRejectedValueOnce(new Error('Falha de conexão'));
  render(<ElectronicAcknowledgementScreen />);
  const pad = await screen.findByTestId('signature-pad');
  fireEvent.changeText(screen.getByLabelText('Nome do destinatário'), 'Maria Silva');
  fireEvent.changeText(screen.getByLabelText('Relação com o atendimento'), 'Proprietária');
  fireEvent(pad, 'change', strokes);
  fireEvent(screen.UNSAFE_getAllByType(Switch)[0], 'valueChange', true);
  await act(async () => fireEvent.press(screen.getByText('Registrar resultado')));
  expect(Alert.alert).toHaveBeenCalledWith('Não foi possível registrar', 'Falha de conexão');
  expect(screen.getByLabelText('Nome do destinatário').props.value).toBe('Maria Silva');
  expect(screen.getByLabelText('Relação com o atendimento').props.value).toBe('Proprietária');
  expect(screen.getByTestId('signature-pad').props.value).toEqual(strokes);
  expect(screen.UNSAFE_getAllByType(Switch)[0].props.value).toBe(true);
  expect(screen.getByRole('button', { name: 'Registrar resultado' })).toBeEnabled();
});

it('encerra o carregamento e informa pendência local quando a nova sincronização falha', async () => {
  mockOnline = true;
  jest.mocked(listAcknowledgementEventsForDocument).mockReturnValue([{
    id: 'event-1', syncStatus: 'failed', outcome: 'acknowledged', recipientName: 'Maria Silva', occurredAtDevice: new Date().toISOString(),
  } as any]);
  jest.mocked(syncPendentes).mockRejectedValueOnce(new Error('Sem conexão'));
  render(<ElectronicAcknowledgementScreen />);
  const button = await screen.findByRole('button', { name: 'Tentar sincronizar novamente' });
  await act(async () => fireEvent.press(button));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tentar sincronizar novamente' })).toBeEnabled());
  expect(Alert.alert).toHaveBeenCalledWith('Sincronização pendente', expect.stringMatching(/salv[ao].*aparelho/i));
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
