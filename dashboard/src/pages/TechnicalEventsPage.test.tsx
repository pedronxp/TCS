// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TechnicalEventsPage } from './TechnicalEventsPage';

const events = [
  {
    id: 'event-1',
    version: '1.4.0',
    platform: 'android',
    category: 'sync',
    severity: 'error',
    correlation: 'corr-1',
    summary: 'Conflito resolvido pelo servidor',
    occurredAt: '2026-07-26T12:00:00.000Z',
    customerId: 'customer-1',
    customerName: 'Defesa Civil',
  },
];

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: events, isLoading: false, isFetching: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => false, user: { id: 'staff-1' }, profile: { role: 'developer' } }),
}));

afterEach(cleanup);

describe('Eventos técnicos unificados', () => {
  it('mantém composição comum e contexto específico da sincronização', () => {
    render(<MemoryRouter><TechnicalEventsPage category="sync" title="Sincronização" /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Sincronização' })).toBeVisible();
    expect(screen.getByText('Filtros da investigação')).toBeVisible();
    expect(screen.queryByLabelText('Filtrar categoria')).not.toBeInTheDocument();
    expect(screen.getByText('Conflito resolvido pelo servidor')).toBeVisible();
    expect(screen.getByText('Defesa Civil')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Defesa Civil' })).not.toBeInTheDocument();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<MemoryRouter><TechnicalEventsPage title="Logs e erros" /></MemoryRouter>);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
