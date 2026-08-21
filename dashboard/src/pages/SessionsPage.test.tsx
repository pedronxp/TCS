// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionsPage } from './SessionsPage';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

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
  device_name: 'Chrome - Windows',
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
      ? { data: { items: [session], total: 1, platforms: { web: 1, android: 0, ios: 0 } }, isLoading: false, error: null, refetch: vi.fn() }
      : { data: { items: [session], total: 1 }, isLoading: false, error: null, refetch: vi.fn() }
  ),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => true, user: { id: 'staff-1' }, profile: { role: 'owner' } }),
}));

vi.mock('@/hooks/useAdministrativeMutation', () => ({
  useAdministrativeMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: rpcMock } }));

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: null, error: null });
});

afterEach(cleanup);

describe('Sessions and devices', () => {
  it('renders the operational overview', () => {
    render(<MemoryRouter><SessionsPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'Sessões' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver dispositivos' })).toHaveAttribute('href', '/app/dispositivo');
    expect(screen.getByText(/sess.*ativas/)).toBeVisible();
    expect(screen.getByText('Atividade Recente')).toBeVisible();
    expect(screen.getByText(/Diretrizes/)).toBeVisible();
    expect(screen.getByText(/Recentes/)).toBeVisible();
  });

  it('has no automated accessibility violations', async () => {
    const { container } = render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('explains the remote revocation safeguard', () => {
    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    expect(screen.getByText(/remota exige/)).toBeVisible();
  });

  it('opens details only after the server returns the protected session detail', async () => {
    let resolveReview: ((value: { data: unknown; error: null }) => void) | undefined;
    rpcMock.mockImplementationOnce(() => new Promise((resolve) => { resolveReview = resolve; }));
    render(<MemoryRouter><SessionsPage /></MemoryRouter>);

    fireEvent.click(screen.getAllByRole('button', { name: 'Detalhes' })[0]);
    expect(screen.getByRole('button', { name: /Carregando/ })).toBeDisabled();
    expect(screen.queryByRole('dialog', { name: /Detalhada/ })).not.toBeInTheDocument();

    resolveReview?.({
      data: {
        session,
        same_device_sessions: [{
          id: session.id,
          status: session.status,
          started_at: session.started_at,
          last_heartbeat_at: session.last_heartbeat_at,
        }],
      },
      error: null,
    });
    expect(await screen.findByRole('dialog', { name: /Detalhada/ })).toBeVisible();
    expect(rpcMock).toHaveBeenCalledWith('get_internal_session_detail', { p_session_id: session.id });
  });

  it('keeps details closed and reports a failed audit', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'audit unavailable' } });
    render(<MemoryRouter><SessionsPage /></MemoryRouter>);

    fireEvent.click(screen.getAllByRole('button', { name: 'Detalhes' })[0]);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/registrar esta revis/));
    expect(screen.queryByRole('dialog', { name: /Detalhada/ })).not.toBeInTheDocument();
  });
});
