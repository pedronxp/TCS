// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OcorrenciasPage } from './OcorrenciasPage';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const { vistoria, hookState } = vi.hoisted(() => {
  const vistoria = {
    id: 'vistoria-1',
    protocolo: 'VST-2026-0001',
    endereco: 'Rua das Flores, 123',
    enderecoRua: 'Rua das Flores',
    enderecoNumero: '123',
    enderecoBairro: 'Centro',
    municipio: 'Aurora',
    nivelRisco: 'r4' as const,
    pontuacaoTotal: 78,
    dataVistoria: '2026-08-04T10:30:00.000Z',
    agenteNome: 'Ana Souza',
    status: 'concluida',
    fotoUrl: null,
    fotosUrls: null,
    laudo_gerado_em: '2026-08-05T09:00:00.000Z',
  };
  return {
    vistoria,
    hookState: {
      data: [vistoria] as typeof vistoria[],
      isLoading: false,
      isError: false,
    },
  };
});

vi.mock('@/hooks/useOcorrencias', () => ({
  useOcorrencias: () => ({
    data: hookState.data,
    isLoading: hookState.isLoading,
    isError: hookState.isError,
    refetch: vi.fn(),
  }),
  getSignedUrl: vi.fn(async () => null),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { role: 'owner', municipio: 'Aurora' },
    can: () => true,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ select: () => ({ order: () => ({ then: () => undefined }) }) })) },
}));

afterEach(() => {
  cleanup();
  hookState.data = [vistoria];
  hookState.isLoading = false;
  hookState.isError = false;
});

describe('Ocorrências', () => {
  it('reproduz cabeçalho, filtros e listagem aprovados', () => {
    render(
      <MemoryRouter>
        <OcorrenciasPage />
      </MemoryRouter>,
    );

    // Cabeçalho monocromático com eyebrow verde.
    expect(screen.getByRole('heading', { level: 1, name: 'Ocorrências' })).toBeVisible();
    expect(screen.getByText('Operacional')).toBeVisible();

    // Filtros compartilhados.
    expect(screen.getByRole('textbox', { name: 'Buscar ocorrências' })).toBeInTheDocument();
    expect(screen.getByText('7 dias')).toBeVisible();

    // Linha da vistoria — endereço e badge de risco.
    expect(screen.getByText('Rua das Flores, 123')).toBeVisible();
    expect(screen.getAllByText('R4').length).toBeGreaterThan(0);
    expect(screen.getByText('Ana Souza')).toBeVisible();
  });

  it('apresenta estado vazio quando não há vistorias', () => {
    hookState.data = [];
    render(
      <MemoryRouter>
        <OcorrenciasPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Nenhuma vistoria encontrada')).toBeVisible();
  });

  it('apresenta estado de carregamento', () => {
    hookState.isLoading = true;
    hookState.data = [];
    render(
      <MemoryRouter>
        <OcorrenciasPage />
      </MemoryRouter>,
    );

    // AsyncBoundary expõe a região de carregamento com aria-busy; o rótulo
    // aparece tanto no span visível quanto no sr-only de acessibilidade.
    const labels = screen.getAllByText('Carregando ocorrências...');
    expect(labels.length).toBeGreaterThanOrEqual(1);
    // A região de carregamento está marcada como ocupada para leitores de tela.
    const busy = document.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    expect(within(busy as HTMLElement).getAllByText('Carregando ocorrências...').length).toBeGreaterThan(0);
  });

  it('abre painel de detalhe ao selecionar uma vistoria', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    render(
      <MemoryRouter>
        <OcorrenciasPage />
      </MemoryRouter>,
    );

    // Linha clicável abre o painel lateral.
    const row = screen.getByText('Rua das Flores, 123').closest('tr')!;
    await userEvent.click(row);

    // Painel mostra protocolo, endereço e agente.
    const panel = screen.getByLabelText('Detalhes da vistoria');
    expect(within(panel).getByText('VST-2026-0001')).toBeVisible();
    expect(within(panel).getByText('Rua das Flores, 123')).toBeVisible();
    expect(within(panel).getByText('Ana Souza')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(
      <MemoryRouter>
        <OcorrenciasPage />
      </MemoryRouter>,
    );
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
