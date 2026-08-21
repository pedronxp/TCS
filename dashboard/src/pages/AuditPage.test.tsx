// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const technicalEvent = {
  source: 'technical',
  id: 'technical-123456789',
  type: 'telemetry.sync.error',
  entity: 'technical_event',
  entityId: 'sync-123',
  actor: 'Sistema',
  result: 'failed',
  reason: 'Falha de sincronização.',
  createdAt: new Date().toISOString(),
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: [auditEvent, technicalEvent],
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
    expect(screen.getByText('Registros encontrados')).toBeVisible();
    expect(screen.getAllByText('Configuração publicada').length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Resumo da auditoria' })).toBeVisible();
    expect(screen.getByText('Contexto sanitizado')).toBeVisible();
    expect(screen.getByText('Publicação aprovada após revisão.')).toBeVisible();
  });

  it('mantém falhas técnicas fora da auditoria de negócio até serem solicitadas', async () => {
    const user = userEvent.setup();
    render(<AuditPage />);

    expect(screen.queryByText('Telemetria de sincronização: erro')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Eventos técnicos' }));

    expect(screen.getByText('Telemetria de sincronização: erro')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<AuditPage />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
