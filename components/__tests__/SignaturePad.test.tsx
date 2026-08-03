import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: require('../../constants/Colors').Colors.light,
    isDark: false,
    themeMode: 'light',
    setThemeMode: jest.fn(),
  }),
}));
import { SignaturePad } from '../SignaturePad';

describe('SignaturePad', () => {
  it('expõe instrução acessível e limpa os traços', () => {
    const onChange = jest.fn();
    const value = [{ points: [
      { x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 },
    ] }];
    const screen = render(<SignaturePad value={value} onChange={onChange} />);
    expect(screen.getByLabelText('Área para assinatura manuscrita')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Limpar assinatura'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('indica visualmente quando a assinatura ainda está vazia', () => {
    const screen = render(<SignaturePad value={[]} onChange={jest.fn()} />);
    expect(screen.getByText('Assine dentro da área')).toBeTruthy();
  });

  it('bloqueia a rolagem externa enquanto o destinatário assina', () => {
    const onInteractionChange = jest.fn();
    const screen = render(
      <SignaturePad
        value={[]}
        onChange={jest.fn()}
        onInteractionChange={onInteractionChange}
      />
    );
    const canvas = screen.getByLabelText('Área para assinatura manuscrita');
    const touch = {
      touchActive: true,
      startPageX: 20,
      startPageY: 30,
      startTimeStamp: 1,
      currentPageX: 20,
      currentPageY: 30,
      currentTimeStamp: 1,
      previousPageX: 20,
      previousPageY: 30,
      previousTimeStamp: 1,
    };
    const touchHistory = {
      touchBank: [touch],
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: 1,
    };

    fireEvent(canvas, 'responderGrant', {
      nativeEvent: { locationX: 20, locationY: 30 },
      touchHistory,
    });
    fireEvent(canvas, 'responderRelease', {
      nativeEvent: { locationX: 20, locationY: 30 },
      touchHistory,
    });

    expect(onInteractionChange).toHaveBeenNthCalledWith(1, true);
    expect(onInteractionChange).toHaveBeenLastCalledWith(false);
  });
});
