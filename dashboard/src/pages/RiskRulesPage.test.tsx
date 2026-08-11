// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RiskRulesPage } from './RiskRulesPage';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

const configs = vi.hoisted(() => {
  const configuration = [
    { nivel: 'r1', label: 'Risco baixo', descricao: 'Monitoramento', minPontos: 0, maxPontos: 24 },
    { nivel: 'r2', label: 'Risco moderado', descricao: 'Vistoria', minPontos: 25, maxPontos: 49 },
    { nivel: 'r3', label: 'Risco alto', descricao: 'Laudo', minPontos: 50, maxPontos: 74 },
    { nivel: 'r4', label: 'Risco crítico', descricao: 'Interdição', minPontos: 75, maxPontos: 9999 },
  ];
  return [{
    municipality: 'Campinas',
    published: configuration,
    updatedAt: '2026-07-26T12:00:00.000Z',
    versions: [
      { version: 13, status: 'draft', configuration, reason: 'Ajuste', createdAt: '2026-07-26T12:00:00.000Z' },
      { version: 12, status: 'published', configuration, reason: 'Publicação', createdAt: '2026-07-20T12:00:00.000Z' },
    ],
  }];
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: configs,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => true, user: { id: 'staff-1' }, profile: { role: 'developer' } }),
}));

vi.mock('@/hooks/useAdministrativeMutation', () => ({
  useAdministrativeMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: rpcMock } }));

afterEach(() => {
  cleanup();
  rpcMock.mockReset();
});

describe('Regras de risco', () => {
  it('reproduz simulação obrigatória, escopo, faixas e histórico', () => {
    render(<RiskRulesPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Regras de risco' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Simule antes de publicar' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Escopo municipal' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Faixas de classificação' })).toBeVisible();
    expect(screen.getByText('Histórico')).toBeVisible();
    expect(screen.getAllByText('R4').length).toBeGreaterThan(0);
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<RiskRulesPage />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('não libera publicação quando a simulação fica fora dos intervalos', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { nivel: 'unclassified', label: 'Fora dos intervalos', score: 10000 },
      error: null,
    });
    render(<RiskRulesPage />);

    fireEvent.change(screen.getByLabelText('Pontuação'), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simular' }));

    expect(await screen.findByText('Fora dos intervalos')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publicar configuração' })).toBeDisabled();
  });
});
