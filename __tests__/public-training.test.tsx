import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import PublicTrainingScreen from '../app/(auth)/treinamento';

const mockReplace = jest.fn();
const mockEnter = jest.fn();
let mockLoading = false;

jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('../constants/Colors').Colors.dark }),
}));
jest.mock('../context/TrainingContext', () => ({
  useTraining: () => ({ enter: mockEnter, loading: mockLoading }),
}));
jest.mock('../utils/supabase', () => ({ supabase: {} }));

function fillEntry(view: ReturnType<typeof render>) {
  fireEvent.changeText(view.getByLabelText('Seu nome'), '  Maria Silva  ');
  fireEvent.changeText(view.getByLabelText('Código da turma'), 'abcd1234efgh');
}

describe('public training entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoading = false;
    mockEnter.mockResolvedValue({ ok: true, status: 'accepted' });
  });

  it('enters a class with a participant name and formatted code without an account', async () => {
    const view = render(<PublicTrainingScreen />);
    fillEntry(view);
    fireEvent.press(view.getByText('ENTRAR NO TREINAMENTO'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(panel)/treinamento'));
    expect(mockEnter).toHaveBeenCalledWith({ nome: 'Maria Silva', token: 'ABCD-1234-EFGH' });
  });

  it('validates participant name and complete class code before requesting entry', () => {
    const view = render(<PublicTrainingScreen />);
    fireEvent.press(view.getByText('ENTRAR NO TREINAMENTO'));
    expect(view.getByText('Informe seu nome para entrar na turma.')).toBeTruthy();
    fireEvent.changeText(view.getByLabelText('Seu nome'), 'Maria');
    fireEvent.changeText(view.getByLabelText('Código da turma'), 'ABC');
    fireEvent.press(view.getByText('ENTRAR NO TREINAMENTO'));
    expect(view.getByText('Informe o código completo da turma.')).toBeTruthy();
    expect(mockEnter).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, status: 'invalid_token' }, /Token de treinamento invalido/],
    [{ ok: false, status: 'expired' }, /Treinamento encerrado/],
    [{ ok: false, status: 'full', participantCount: 10, participantLimit: 10 }, /Limite de participantes atingido/],
  ])('keeps rejected entry on the public form: %j', async (result, message) => {
    mockEnter.mockResolvedValue(result);
    const view = render(<PublicTrainingScreen />);
    fillEntry(view);
    fireEvent.press(view.getByText('ENTRAR NO TREINAMENTO'));
    expect(await view.findByText(message)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('prevents duplicate entry requests while waiting', async () => {
    let complete!: (value: unknown) => void;
    mockEnter.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const view = render(<PublicTrainingScreen />);
    fillEntry(view);
    const button = view.getByText('ENTRAR NO TREINAMENTO');
    fireEvent.press(button);
    fireEvent.press(button);
    expect(mockEnter).toHaveBeenCalledTimes(1);
    await act(async () => complete({ ok: true, status: 'accepted' }));
  });

  it('waits for training storage initialization and returns to welcome', () => {
    mockLoading = true;
    const view = render(<PublicTrainingScreen />);
    fillEntry(view);
    fireEvent.press(view.getByText('ENTRAR NO TREINAMENTO'));
    expect(mockEnter).not.toHaveBeenCalled();
    fireEvent.press(view.getByText('Voltar'));
    expect(mockReplace).toHaveBeenCalledWith('/(auth)');
  });
});
