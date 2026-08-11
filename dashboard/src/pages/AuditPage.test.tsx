// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditPage } from './AuditPage';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const auditEvent = {
  source: 'internal',
  id: 'event-123456789',
  type: 'configuration.published',
  entity: 'configuration',
  entityId: 'configuration-18',
  actor: 'Pedro Paulo',
  result: 'allowed',
  reason: 'Publicação aprovada após revisão.',
  createdAt: new Date().toISOString(),
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: [auditEvent],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'staff-1' }, profile: { role: 'auditor' } }),
}));

afterEach(cleanup);

describe('Timeline de auditoria', () => {
  it('reproduz filtros, timeline e inspetor sanitizado aprovados', () => {
    render(<AuditPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Auditoria' })).toBeVisible();
    expect(screen.getByText('Linha do tempo')).toBeVisible();
    expect(screen.getAllByText('Configuration published').length).toBeGreaterThan(0);
    expect(screen.getByText('Contexto sanitizado')).toBeVisible();
    expect(screen.getByText('Publicação aprovada após revisão.')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<AuditPage />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
