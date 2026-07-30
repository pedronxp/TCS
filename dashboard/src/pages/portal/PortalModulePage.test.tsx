// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { PortalModulePage } from './PortalModulePage';

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as { items: Array<Record<string, unknown>>; summary: Record<string, number | string | boolean | null> } | undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  access: {
    accountKind: 'individual' as const,
    userId: 'user',
    organizationId: null,
    features: { reports: true } as Record<string, boolean>,
    creationAllowed: true,
  },
}));

vi.mock('@tanstack/react-query', () => ({ useQuery: () => mocks.query }));
vi.mock('@/contexts/PortalAuthContext', () => ({ usePortalAuth: () => ({ access: mocks.access }) }));
vi.mock('@/lib/portal', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/portal')>();
  return { ...original, fetchPortalWorkspace: vi.fn() };
});

function renderModule(section = 'vistorias') {
  return render(<MemoryRouter><PortalModulePage section={section} /></MemoryRouter>);
}

describe('estados dos módulos do portal', () => {
  beforeEach(() => {
    mocks.query.data = undefined;
    mocks.query.isLoading = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockReset();
    mocks.access.features = { reports: true };
    mocks.access.creationAllowed = true;
  });
  afterEach(cleanup);

  it('expõe estado de carregamento acessível', () => {
    mocks.query.isLoading = true;
    const { container } = renderModule();
    expect(container.querySelectorAll('[class*="animate-pulse"]')).toHaveLength(4);
  });

  it('expõe erro recuperável', () => {
    mocks.query.isError = true;
    renderModule();
    expect(screen.getByText('Não foi possível carregar este módulo.')).toBeVisible();
    screen.getByRole('button', { name: /tentar novamente/i }).click();
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });

  it('diferencia vazio de filtro sem resultado', () => {
    mocks.query.data = { items: [], summary: {} };
    const { rerender } = renderModule();
    expect(screen.getByText('Quando houver registros neste escopo, eles aparecerão aqui.')).toBeVisible();
    mocks.query.data = { items: [{ id: '1', title: 'Sem correspondência', status: 'pendente' }], summary: {} };
    rerender(<MemoryRouter><PortalModulePage section="vistorias" /></MemoryRouter>);
    expect(screen.getByText('Sem correspondência')).toBeVisible();
  });

  it('preserva a explicação de bloqueio por plano e a comparação pública', () => {
    mocks.access.features = { reports: false };
    renderModule('relatorios');
    expect(screen.getByRole('heading', { name: 'Recurso disponível em outro plano' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Comparar planos' })).toHaveAttribute('href', '/planos');
  });

  it('mantém o estado base sem violações automatizadas de acessibilidade', async () => {
    mocks.query.data = { items: [{ id: '1', title: 'TCS-001', status: 'concluida' }], summary: { inspections: 1 } };
    const { container } = renderModule();
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
