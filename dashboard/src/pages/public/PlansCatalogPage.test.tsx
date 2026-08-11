// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { PlansCatalogPage } from './PlansCatalogPage';

afterEach(cleanup);

describe('catálogo público de planos', () => {
  it('separa planos individuais e municipais com valores e limites aprovados', () => {
    render(<MemoryRouter><PlansCatalogPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'Primeiro, escolha como você opera.' })).toBeVisible();
    const individual = screen.getByRole('region', { name: 'Para quem realiza e entrega as próprias vistorias' });
    const municipal = screen.getByRole('region', { name: 'Para prefeituras que coordenam agentes e território' });
    expect(within(individual).getAllByRole('article')).toHaveLength(2);
    expect(within(municipal).getAllByRole('article')).toHaveLength(3);
    expect(within(individual).getByText(/R\$\s*79,90/)).toBeVisible();
    expect(within(municipal).getByText(/R\$\s*1\.490,00/)).toBeVisible();
    expect(screen.getByText('O valor anual equivale a 10 mensalidades. O Municipal Completo exibe um valor-base, que pode ser ajustado na proposta conforme o contrato.')).toBeVisible();
    expect(screen.queryByText('Mais escolhido')).not.toBeInTheDocument();
  });

  it('explica o próximo passo nos CTAs', () => {
    render(<MemoryRouter><PlansCatalogPage /></MemoryRouter>);
    const individualCtas = screen.getAllByRole('link', { name: 'Continuar para criar conta' });
    expect(individualCtas).toHaveLength(2);
    individualCtas.forEach((cta) => expect(cta).toHaveAttribute('href', '/criar-conta'));
    expect(screen.queryByRole('link', { name: /Individual Básico|Individual Profissional/ })).not.toBeInTheDocument();
    expect(individualCtas.every((cta) => !cta.getAttribute('href')?.includes('plan='))).toBe(true);
    expect(screen.getByRole('link', { name: 'Solicitar proposta do Municipal Básico' })).toHaveAttribute('href', expect.stringContaining('mailto:comercial@tcs.app'));
  });

  it('não apresenta carência ou teste sem explicar a semântica contratual', () => {
    render(<MemoryRouter><PlansCatalogPage /></MemoryRouter>);
    expect(screen.queryByText(/carência/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/teste de \d+ dias/i)).not.toBeInTheDocument();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<MemoryRouter><PlansCatalogPage /></MemoryRouter>);
    const result = await axe(container);
    expect(result.violations).toEqual([]);
  });
});
