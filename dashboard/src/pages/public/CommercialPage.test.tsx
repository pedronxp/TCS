// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommercialPage } from './CommercialPage';
import { PUBLIC_PLANS } from '@/config/publicPlans';

const supabaseMock = vi.hoisted(() => ({ maybeSingle: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabaseConfigurationAvailable: true,
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: supabaseMock.maybeSingle }),
      }),
    }),
  },
}));

beforeEach(() => {
  supabaseMock.maybeSingle.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

  it('segmenta a oferta sem criar planos ou provas fora do catálogo', async () => {
    render(<MemoryRouter><CommercialPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Registre a vistoria uma vez. Use a evidência até a decisão.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Três etapas, o mesmo registro.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Individual ou Municipal: comece pela comparação certa.' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Individual' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Municipal' })).toBeVisible();
    expect(screen.queryByText('Essencial')).not.toBeInTheDocument();
    expect(screen.queryByText('Enterprise')).not.toBeInTheDocument();
    expect(screen.queryByText('Mais escolhido')).not.toBeInTheDocument();
    expect(screen.queryByText('98/100')).not.toBeInTheDocument();
    expect(screen.queryByText('Municipal Profissional')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Do primeiro acesso à operação em campo.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Diga como sua equipe trabalha hoje.' })).toBeVisible();
    expect(screen.getByText('privacidade@tcs.app')).toBeVisible();
    expect(screen.getByText('Agentes')).toBeVisible();
    expect(screen.queryByText('248')).not.toBeInTheDocument();
    expect(await screen.findByText('Prévia sem dados de produção')).toBeVisible();
    expect(screen.getByText('Exemplo')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Comparar preços e limites' })).toHaveAttribute('href', '/planos');
    expect(screen.getByRole('link', { name: 'Comparar planos individuais' })).toHaveAttribute('href', '/planos#individual');
    expect(screen.getByRole('link', { name: 'Comparar planos municipais' })).toHaveAttribute('href', '/planos#municipal');
  });

  it('sincroniza selo, conteúdo e timestamp quando existem dados públicos', async () => {
    supabaseMock.maybeSingle.mockResolvedValue({
      data: {
        total_vistorias: 128,
        pendencias: 7,
        agentes: 12,
        latest_protocols: [{ protocolo: 'tcs-2042', risco: 'r2' }],
        updated_at: '2026-08-08T18:30:00.000Z',
      },
      error: null,
    });

    render(<MemoryRouter><CommercialPage /></MemoryRouter>);

    const preview = within(screen.getByLabelText('Prévia da operação municipal'));
    expect(await preview.findByText('Dados públicos')).toBeVisible();
    expect(preview.getByText('128')).toBeVisible();
    expect(preview.getByText('7')).toBeVisible();
    expect(preview.getByText('12')).toBeVisible();
    expect(preview.getByText('TCS-2042')).toBeVisible();
    expect(preview.getByText(/Atualizado em 08\/08\/2026.*15:30/)).toBeVisible();
    expect(preview.queryByText('Exemplo')).not.toBeInTheDocument();
    expect(preview.queryByText('Prévia sem dados de produção')).not.toBeInTheDocument();
  });

  it('omite teste e carência sem semântica comercial aprovada', () => {
    render(<MemoryRouter><CommercialPage /></MemoryRouter>);
    expect(screen.queryByText(/\d+ dias de teste/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/carência/i)).not.toBeInTheDocument();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<MemoryRouter><CommercialPage /></MemoryRouter>);
    await waitFor(() => expect(supabaseMock.maybeSingle).toHaveBeenCalled());
    const result = await axe(container);
    expect(result.violations).toEqual([]);
  });
});
