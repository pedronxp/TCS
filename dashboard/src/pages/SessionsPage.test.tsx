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
  useAuth: () => ({
    can: () => true,
    user: { id: 'staff-1' },
    profile: { role: 'owner' },
  }),
}));

vi.mock('@/hooks/useAdministrativeMutation', () => ({
  useAdministrativeMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: rpcMock },
}));

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: null, error: null });
});

afterEach(cleanup);

describe('Sessões e dispositivos', () => {
  it('reproduz pulso, anomalias, política e listagem aprovados', () => {
    render(<MemoryRouter><SessionsPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'Sessões' })).toBeVisible();
    expect(screen.getByText('1 sessão ativa')).toBeVisible();
    expect(screen.getByText('Atividade recente')).toBeVisible();
    expect(screen.getByText('Política aplicada')).toBeVisible();
    expect(screen.getByText('Sessões recentes')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('deixa explícito que a revogação remota exige confirmação e motivo', () => {
    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    expect(screen.getByText(/revogação remota exige confirmação e motivo/)).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Sessões' })).toBeVisible();
  });

  it('só revela detalhes depois que o servidor confirma o registro da auditoria', async () => {
    let resolveReview: ((value: { data: null; error: null }) => void) | undefined;
    rpcMock.mockImplementationOnce(() => new Promise((resolve) => { resolveReview = resolve; }));
    render(<MemoryRouter><SessionsPage /></MemoryRouter>);

    fireEvent.click(screen.getAllByRole('button', { name: 'Revisar' })[0]);
    expect(screen.getByRole('button', { name: 'Registrando…' })).toBeDisabled();
    expect(screen.queryByRole('dialog', { name: 'Revisar sessão' })).not.toBeInTheDocument();

    resolveReview?.({ data: null, error: null });
    expect(await screen.findByRole('dialog', { name: 'Revisar sessão' })).toBeVisible();
    expect(rpcMock).toHaveBeenCalledWith('record_internal_session_review', { p_session_id: session.id });
  });

  it('mantém os detalhes fechados e informa quando a auditoria falha', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'audit unavailable' } });
    render(<MemoryRouter><SessionsPage /></MemoryRouter>);

    fireEvent.click(screen.getAllByRole('button', { name: 'Revisar' })[0]);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Os detalhes permaneceram fechados'));
    expect(screen.queryByRole('dialog', { name: 'Revisar sessão' })).not.toBeInTheDocument();
  });
});
