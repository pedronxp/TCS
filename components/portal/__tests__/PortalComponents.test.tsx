import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PortalStateCard, PortalStatusBadge } from '..';
import { PortalSemanticTokens } from '../../../constants/PortalSemanticTokens';

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

describe('componentes nativos do portal', () => {
  it('apresenta o estado semântico da assinatura para tecnologia assistiva', () => {
    render(<PortalStatusBadge status="active" />);

    expect(screen.getByText('Assinatura ativa')).toBeTruthy();
    expect(screen.getByLabelText('Status da assinatura: Assinatura ativa')).toBeTruthy();
  });

  it('prioriza o cancelamento agendado sobre o estado ativo', () => {
    render(<PortalStatusBadge status="active" cancelAtPeriodEnd />);

    expect(screen.getByText('Cancelamento agendado')).toBeTruthy();
  });

  it('expõe carregamento como região ocupada', () => {
    render(
      <PortalStateCard
        kind="loading"
        title="Carregando assinatura"
        description="Consultando plano e consumo."
      />,
    );

    expect(screen.getByLabelText('Carregando assinatura').props.accessibilityState)
      .toEqual({ busy: true });
  });

  it('mantém a ação de recuperação acessível e funcional', () => {
    const retry = jest.fn();
    render(
      <PortalStateCard
        kind="error"
        title="Falha ao carregar"
        actionLabel="Tentar novamente"
        onAction={retry}
      />,
    );

    const action = screen.getByRole('button', { name: 'Tentar novamente' });
    const actionStyle = StyleSheet.flatten(action.props.style);

    expect(actionStyle.minHeight).toBeGreaterThanOrEqual(
      PortalSemanticTokens.accessibility.minimumTouchTarget,
    );
    fireEvent.press(action);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('mantém escala de texto habilitada nos conteúdos essenciais', () => {
    render(
      <PortalStateCard
        kind="empty"
        title="Nenhum item encontrado"
        description="Os registros aparecerão aqui."
      />,
    );

    expect(screen.getByText('Nenhum item encontrado').props.allowFontScaling).not.toBe(false);
    expect(screen.getByText('Os registros aparecerão aqui.').props.allowFontScaling).not.toBe(false);
  });

  it.each(['light', 'dark'] as const)('mantém contraste AA nos tokens de texto do tema %s', (mode) => {
    const theme = PortalSemanticTokens[mode];
    const pairs = [
      [theme.foreground, theme.background],
      [theme.mutedForeground, theme.background],
      [theme.primary, theme.onPrimary],
      [theme.success, theme.successSurface],
      [theme.warning, theme.warningSurface],
      [theme.danger, theme.dangerSurface],
      [theme.information, theme.informationSurface],
    ];

    for (const [foreground, background] of pairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(
        PortalSemanticTokens.accessibility.minimumTextContrast,
      );
    }
  });
});

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}
