// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommercialPage } from './CommercialPage';

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

describe('página pública de apresentação do sistema', () => {
  it('apresenta o sistema sem superfície de venda', async () => {
    render(<MemoryRouter><CommercialPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'Registre a vistoria uma vez. Use a evidência até a decisão.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Três etapas, o mesmo registro.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Tudo que a operação usa, todos os dias.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Controles reais, auditáveis a qualquer momento.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Duas portas, um mesmo sistema.' })).toBeVisible();

    // Funções reais do sistema presentes
    expect(screen.getByRole('heading', { level: 3, name: 'Vistoria com protocolo oficial' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Classificação de risco R1–R4' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Offline-first' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Bot WhatsApp com IA' })).toBeVisible();

    // Sem elementos comerciais
    expect(screen.queryByText(/a partir de/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/comparar planos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/preç/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /planos/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/comercial@tcs\.app/)).not.toBeInTheDocument();
  });

  it('oferece apenas as duas portas de acesso (console e portal)', () => {
    render(<MemoryRouter><CommercialPage /></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Entrar no console' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Portal do cliente' })).toHaveAttribute('href', '/entrar');
    expect(screen.getByRole('link', { name: 'Ir para o console' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Ir para o portal' })).toHaveAttribute('href', '/entrar');
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

  it('lista controles de segurança reais do sistema', () => {
    render(<MemoryRouter><CommercialPage /></MemoryRouter>);

    expect(screen.getByText('Isolamento por organização com Row Level Security no banco')).toBeVisible();
    expect(screen.getByText('LGPD: nenhum CPF em tela, modelo ou banco')).toBeVisible();
    expect(screen.getByText('privacidade@tcs.app')).toBeVisible();
  });

  it('não apresenta semântica comercial', () => {
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
