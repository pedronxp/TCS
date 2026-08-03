import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Button } from '../Button';
import { FormField } from '../FormField';
import { ListRow } from '../ListRow';
import { ModuleCard } from '../ModuleCard';
import { StateBanner } from '../StateBanner';
import { FlowProgress } from '../FlowProgress';

const mockImpactAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Feather: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: require('../../../constants/Colors').Colors.light,
    isDark: false,
    themeMode: 'light',
  }),
}));

describe('TCS V5 UI foundations', () => {
  beforeEach(() => mockImpactAsync.mockClear());

  it('executes the primary action with accessible semantics and haptics', () => {
    const onPress = jest.fn();
    const view = render(<Button label="Continuar" onPress={onPress} />);

    fireEvent.press(view.getByRole('button', { name: 'Continuar' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
  });

  it('blocks disabled actions', () => {
    const onPress = jest.fn();
    const view = render(<Button label="Gerar laudo" onPress={onPress} disabled />);

    fireEvent.press(view.getByRole('button', { name: 'Gerar laudo' }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows required and error states without removing helper context', () => {
    const onChangeText = jest.fn();
    const view = render(
      <FormField
        label="Endereço"
        required
        value=""
        error="Informe o endereço da vistoria"
        onChangeText={onChangeText}
      />,
    );

    expect(view.getByText('Informe o endereço da vistoria')).toBeTruthy();
    fireEvent.changeText(view.getByLabelText('Endereço'), 'Rua das Flores, 120');
    expect(onChangeText).toHaveBeenCalledWith('Rua das Flores, 120');
  });

  it('keeps list and module actions explicit', () => {
    const openList = jest.fn();
    const openModule = jest.fn();
    const view = render(
      <>
        <ListRow title="Vistorias" subtitle="Histórico e laudos" icon="clipboard" onPress={openList} />
        <ModuleCard title="Mapa" description="Cobertura e risco" icon="map" onPress={openModule} />
      </>,
    );

    fireEvent.press(view.getByRole('button', { name: 'Mapa. Cobertura e risco' }));
    fireEvent.press(view.getByText('Vistorias'));

    expect(openModule).toHaveBeenCalledTimes(1);
    expect(openList).toHaveBeenCalledTimes(1);
  });

  it('offers a recovery action in critical state banners', () => {
    const onAction = jest.fn();
    const view = render(
      <StateBanner
        title="Sem conexão"
        description="A vistoria continua salva neste aparelho."
        variant="warning"
        actionLabel="Continuar offline"
        onAction={onAction}
      />,
    );

    fireEvent.press(view.getByRole('button', { name: 'Continuar offline' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('announces the current stage of a multi-step flow', () => {
    const view = render(<FlowProgress currentStep={2} totalSteps={3} label="Modelo técnico" />);

    const progress = view.getByLabelText('Etapa 2 de 3, Modelo técnico');
    expect(progress.props.accessibilityValue).toEqual({ min: 1, max: 3, now: 2 });
    expect(view.getByText('Etapa 2 de 3')).toBeTruthy();
    expect(view.getByText('Modelo técnico')).toBeTruthy();
  });
});
