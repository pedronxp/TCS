import React from 'react';
import { render } from '@testing-library/react-native';
import { OpeningBoot, ProductIdentity, RiskBar, TCSMark } from '../TCSBrand';
jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('../../../constants/Colors').Colors.dark, isDark: true, themeMode: 'dark' }),
}));

describe('TCS brand primitives', () => {
  it('renders the approved product hierarchy in the hero variant', () => {
    const view = render(<ProductIdentity variant="hero" />);
    expect(view.getAllByText('TCS').length).toBeGreaterThan(0);
    expect(view.getByText('RELATÓRIO E RISCO')).toBeTruthy();
    expect(view.getByText('Plataforma de vistoria técnica para Defesa Civil')).toBeTruthy();
  });

  it('keeps the mark compact without municipal identity', () => {
    const view = render(<TCSMark size={48} />);
    expect(view.getByLabelText('TCS Relatório e Risco')).toBeTruthy();
    expect(view.queryByText(/Municipal/i)).toBeNull();
  });

  it('exposes the R1 to R4 classification accessibly', () => {
    const view = render(<RiskBar labelled />);
    expect(view.getByLabelText('Classificação de risco R1 a R4')).toBeTruthy();
    expect(view.getByText('R1')).toBeTruthy();
    expect(view.getByText('R4')).toBeTruthy();
  });

  it('renders branded boot feedback instead of a spinner-only screen', () => {
    const view = render(<OpeningBoot />);
    expect(view.getByLabelText('Inicializando TCS')).toBeTruthy();
    expect(view.getByText('RELATÓRIO E RISCO')).toBeTruthy();
    expect(view.getByLabelText('Carregando')).toBeTruthy();
  });
});
