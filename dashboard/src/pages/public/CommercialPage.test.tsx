// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { CommercialPage } from './CommercialPage';
import { PUBLIC_PLANS } from '@/config/publicPlans';

afterEach(cleanup);

describe('experiência comercial pública', () => {
  it('usa somente o catálogo público aprovado', () => {
    expect(PUBLIC_PLANS).toHaveLength(5);
    expect(PUBLIC_PLANS.map((plan) => plan.name)).toEqual([
      'Individual Básico',
      'Individual Profissional',
      'Municipal Básico',
      'Municipal Profissional',
      'Municipal Completo',
    ]);
  });

  it('apresenta as seções e ofertas aprovadas no Penpot sem dados internos', () => {
    render(<MemoryRouter><CommercialPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Da vistoria em campo à decisão de gestão.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Uma plataforma. Três momentos decisivos.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Confiança não é um recurso extra.' })).toBeVisible();
    expect(screen.getByText('Essencial')).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Municipal' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Enterprise' })).toBeVisible();
    expect(screen.queryByText('Municipal Profissional')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Do primeiro acesso à operação em campo.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Fale direto com a equipe certa.' })).toBeVisible();
    expect(screen.getByText('privacidade@tcs.app')).toBeVisible();
    expect(screen.getByText('Agentes')).toBeVisible();
    expect(screen.queryByText('248')).not.toBeInTheDocument();
    expect(screen.getByText('Dados oficiais · atualização automática')).toBeVisible();
    expect(screen.queryByText('Plataforma para operações de campo')).not.toBeInTheDocument();
    expect(screen.queryByText('14 dias para testar')).not.toBeInTheDocument();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<MemoryRouter><CommercialPage /></MemoryRouter>);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
