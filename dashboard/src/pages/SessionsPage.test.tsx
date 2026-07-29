// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionsPage } from './SessionsPage';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const session = {
  id: 'session-1',
  user_id: 'user-123456789',
  organization_id: 'organization-1',
  device_id: 'device-1',
  device_name: 'Chrome · Windows',
  platform: 'web',
  status: 'active',
  started_at: new Date().toISOString(),
  last_heartbeat_at: new Date().toISOString(),
  organizations: {
    display_name: 'Prefeitura de Aurora',
    session_policy: 'block',
    session_timeout_minutes: 720,
    offline_tolerance_minutes: 60,
  },
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => (
    queryKey[0] === 'internal-sessions-overview'
      ? {
          data: { items: [session], total: 1, platforms: { web: 1, android: 0, ios: 0 } },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }
      : {
          data: { items: [session], total: 1 },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }
  ),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('@/hooks/useAdministrativeMutation', () => ({
  useAdministrativeMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

afterEach(cleanup);

describe('Sessões e dispositivos', () => {
  it('reproduz pulso, anomalias, política e listagem aprovados', () => {
    render(<MemoryRouter><SessionsPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'Sessões' })).toBeVisible();
    expect(screen.getByText('1 sessão ativa')).toBeVisible();
    expect(screen.getByText('Mapa de anomalias')).toBeVisible();
    expect(screen.getByText('Política aplicada')).toBeVisible();
    expect(screen.getByText('Sessões recentes')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
