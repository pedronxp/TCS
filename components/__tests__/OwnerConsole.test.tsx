import React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react-native';
import { Linking } from 'react-native';
import OwnerConsoleScreen from '../../app/(panel)/internal/console';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: { background: '#fff', textSecondary: '#444', primary: '#111' } }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ section: 'plans' }), router: { back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef((props: any, _ref: any) => React.createElement(require('react-native').View, { ...props, testID: 'owner-console-web' })) };
});
jest.mock('../ui', () => {
  const React = require('react'); const { Text, Pressable, View } = require('react-native');
  return {
    AppHeader: ({ title }: any) => React.createElement(Text, {}, title),
    Button: ({ label, onPress }: any) => React.createElement(Pressable, { onPress }, React.createElement(Text, {}, label)),
    ErrorState: ({ message }: any) => React.createElement(Text, {}, message),
    StateBanner: ({ title, description }: any) => React.createElement(View, {}, React.createElement(Text, {}, title), React.createElement(Text, {}, description)),
  };
});

describe('owner console inside the app', () => {
  beforeEach(() => { jest.clearAllMocks(); (useAuth as jest.Mock).mockReturnValue({ profile: { uid: 'owner', role: 'owner' } }); });
  it('does not mount a console for an ordinary account', () => {
    (useAuth as jest.Mock).mockReturnValue({ profile: { uid: 'agent', role: 'agent' } });
    render(<OwnerConsoleScreen />);
    expect(screen.getByText('Acesso exclusivo do proprietário.')).toBeTruthy();
    expect(screen.queryByTestId('owner-console-web')).toBeNull();
  });
  it('starts a separate login session without native credentials', () => {
    render(<OwnerConsoleScreen />);
    const props = screen.getByTestId('owner-console-web').props;
    expect(props.source).toEqual({ uri: 'https://tcsvistoria.pages.dev/app/planos' });
    expect(props.incognito).toBe(true);
    expect(props.sharedCookiesEnabled).toBe(false);
    expect(props.injectedJavaScript).toBeUndefined();
    expect(props.injectedJavaScriptBeforeContentLoaded).toBeUndefined();
  });
  it('external navigation waits for a deliberate tap and never leaves via a script URL', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    render(<OwnerConsoleScreen />);
    const navigate = screen.getByTestId('owner-console-web').props.onShouldStartLoadWithRequest;
    let allowed = true;
    act(() => { allowed = navigate({ url: 'https://external.test/document' }); });
    expect(allowed).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(navigate({ url: 'javascript:alert(1)' })).toBe(false);
    await act(async () => { fireEvent.press(screen.getByText('Abrir no navegador')); });
    expect(open).toHaveBeenCalledWith('https://external.test/document');
    open.mockRestore();
  });
});
