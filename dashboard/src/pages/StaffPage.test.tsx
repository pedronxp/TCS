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

afterEach(cleanup);

describe('Equipe interna', () => {
  it('reproduz destaque, diretório e cobertura de papéis', () => {
    render(<StaffPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Equipe interna' })).toBeVisible();
    expect(screen.getByText('Time em destaque')).toBeVisible();
    expect(screen.getByText('Diretório')).toBeVisible();
    expect(screen.getByText('Cobertura de papéis')).toBeVisible();
    expect(screen.getByText('Estado de acesso')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<StaffPage />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
