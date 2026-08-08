import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import WelcomeScreen from '../app/(auth)/index';

const mockPush = jest.fn();
let mockConnected = true;
let mockOnline = true;

jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) }));
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('../constants/Colors').Colors.dark, isDark: true, themeMode: 'dark' }),
}));
jest.mock('../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isConnected: mockConnected, isOnlineReal: mockOnline, connectionType: 'wifi' }),
}));

describe('public TCS entry', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockConnected = true;
    mockOnline = true;
  });

  it('shows the approved hierarchy and no personal credit', () => {
    const view = render(<WelcomeScreen />);
    expect(view.getByText('RELATÓRIO DE RISCO')).toBeTruthy();
    expect(view.getByText('Plataforma de vistoria técnica para Defesa Civil')).toBeTruthy();
    expect(view.queryByText(/Pedronxp/i)).toBeNull();
    expect(view.queryByText(/Defesa Civil Municipal/i)).toBeNull();
  });

  it('maps the simplified entry actions to account, preview and product routes', () => {
    const view = render(<WelcomeScreen />);
    fireEvent.press(view.getByText('ACESSAR SISTEMA'));
    fireEvent.press(view.getByText('Criar conta'));
    fireEvent.press(view.getByText('Conhecer planos'));
    fireEvent.press(view.getByText('EXPERIMENTAR O TCS'));
    fireEvent.press(view.getByText('CONHECER A PLATAFORMA'));
    expect(mockPush).toHaveBeenNthCalledWith(1, '/(auth)/login');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/(auth)/register');
    expect(mockPush).toHaveBeenNthCalledWith(3, '/(auth)/planos');
    expect(mockPush).toHaveBeenNthCalledWith(4, '/(auth)/preview');
    expect(mockPush).toHaveBeenNthCalledWith(5, '/onboarding');
    expect(view.queryByText('Vistoria')).toBeNull();
    expect(view.queryByText('Território')).toBeNull();
    expect(view.queryByText('Laudos')).toBeNull();
    expect(view.queryByText('Offline')).toBeNull();
  });

  it('reports offline state without claiming the system is online', () => {
    mockConnected = false;
    mockOnline = false;
    const view = render(<WelcomeScreen />);
    expect(view.getByText('MODO OFFLINE')).toBeTruthy();
    expect(view.queryByText('SISTEMA ONLINE')).toBeNull();
  });

  it('updates connectivity wording after reconnection', () => {
    mockConnected = false;
    mockOnline = false;
    const view = render(<WelcomeScreen />);
    expect(view.getByText('MODO OFFLINE')).toBeTruthy();
    mockConnected = true;
    mockOnline = true;
    view.rerender(<WelcomeScreen />);
    expect(view.getByText('CONEXÃO DISPONÍVEL')).toBeTruthy();
  });
});
