// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VersionsPage } from './VersionsPage';

const versionData = vi.hoisted(() => ({
  settings: {
    published_version: '2.17.0',
    minimum_version: '2.16.4',
    development_version: '2.18.0-dev.12',
    updated_at: '2026-07-25T00:00:00.000Z',
  },
  rows: [
    {
      version: '2.18.0-dev.12',
      status: 'development',
      changelog: 'Novo mapa offline\nCorreção de sessões expiradas\nReforço de MFA administrativo',
      published_at: null,
      updated_at: '2026-07-26T00:00:00.000Z',
      adoption: 6,
    },
    {
      version: '2.17.0',
      status: 'published',
      changelog: 'Release estável',
      published_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-20T00:00:00.000Z',
      adoption: 145,
    },
    {
      version: '2.16.4',
      status: 'retired',
      changelog: 'Versão mínima anterior',
      published_at: '2026-06-20T00:00:00.000Z',
      updated_at: '2026-06-20T00:00:00.000Z',
      adoption: 3,
    },
  ],
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: versionData,
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

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

afterEach(cleanup);

describe('Gestão de versões', () => {
  it('reproduz release train, catálogo, adoção e changelog', () => {
    render(<VersionsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Versões' })).toBeVisible();
    expect(screen.getByText('Release train')).toBeVisible();
    expect(screen.getByText('Adoção observada')).toBeVisible();
    expect(screen.getByText('Mínima suportada')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Mudanças em desenvolvimento' })).toBeVisible();
    expect(screen.getAllByText('2.17.0').length).toBeGreaterThan(0);
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<VersionsPage />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
