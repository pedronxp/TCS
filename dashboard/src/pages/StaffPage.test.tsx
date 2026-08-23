// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StaffPage } from './StaffPage';

const staffRows = vi.hoisted(() => [
  {
    user_id: '11111111-1111-4111-8111-111111111111',
    role: 'owner',
    status: 'active',
    display_name: 'Pedro Paulo',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-07-25T00:00:00.000Z',
  },
  {
    user_id: '22222222-2222-4222-8222-222222222222',
    role: 'developer',
    status: 'active',
    display_name: 'Ana Lima',
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-07-24T00:00:00.000Z',
  },
]);

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: staffRows,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAdministrativeMutation', () => ({
  useAdministrativeMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => true, user: { id: 'staff-1' }, profile: { role: 'owner' } }),
}));

afterEach(cleanup);

describe('Pessoas e acessos', () => {
  it('reproduz postura, diretório e cobertura de papéis', () => {
    render(<StaffPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Pessoas e acessos' })).toBeVisible();
    expect(screen.getByText('Postura de acesso')).toBeVisible();
    expect(screen.getByText('Diretório')).toBeVisible();
    expect(screen.getByText('Cobertura de papéis')).toBeVisible();
    expect(screen.getByText('Estado de acesso')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<StaffPage />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('sinaliza que mudanças em Owner/Developer são de alto risco e exigem MFA', () => {
    render(<StaffPage />);
    expect(screen.getByText(/exigem MFA/)).toBeVisible();
    expect(screen.getByText(/alto risco/)).toBeVisible();
  });
});
