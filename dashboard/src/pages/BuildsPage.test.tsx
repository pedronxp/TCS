// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuildsPage } from './BuildsPage';

const buildData = vi.hoisted(() => ({
  requests: [
    {
      id: 'request-1',
      operation_id: 'operation-1',
      requested_by: 'owner-2',
      approved_by: 'owner-1',
      provider: 'eas',
      environment: 'preview',
      version: '2.18.0-rc.3',
      profile: 'Android',
      changelog: 'Candidata para homologação',
      reason: 'Preparar homologação',
      status: 'executed',
      created_at: '2026-07-26T12:00:00.000Z',
      decided_at: '2026-07-26T12:02:00.000Z',
      executed_at: '2026-07-26T12:03:00.000Z',
    },
  ],
  builds: [
    {
      id: 'build-842',
      provider: 'eas',
      version: '2.18.0-rc.3',
      profile: 'Android',
      changelog: 'Candidata para homologação',
      status: 'building',
      initiated_by: 'owner-1',
      initiated_by_name: 'João Lima',
      created_at: '2026-07-26T12:03:00.000Z',
      completed_at: null,
      eas_build_id: 'eas-build-842',
      github_run_id: null,
      apk_url: null,
      drive_folder_url: null,
      error_message: null,
    },
    {
      id: 'build-841',
      provider: 'github',
      version: '2.17.0',
      profile: 'iOS',
      changelog: 'Release estável',
      status: 'succeeded',
      initiated_by: 'owner-2',
      initiated_by_name: 'Ana Lima',
      created_at: '2026-07-25T12:00:00.000Z',
      completed_at: '2026-07-25T12:18:00.000Z',
      eas_build_id: null,
      github_run_id: '841',
      apk_url: 'https://example.com/artifact',
      drive_folder_url: null,
      error_message: null,
    },
  ],
  events: [
    {
      id: 'event-1',
      version: '2.18.0-rc.3',
      severity: 'info',
      correlation: 'request-1',
      summary: 'Build iniciado',
      occurredAt: '2026-07-26T12:03:00.000Z',
    },
  ],
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: buildData,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    can: () => true,
    user: { id: 'owner-1' },
    profile: { userId: 'owner-1', displayName: 'Pedro Paulo', role: 'owner' },
  }),
}));

vi.mock('@/hooks/useAdministrativeMutation', () => ({
  useAdministrativeMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

afterEach(cleanup);

describe('Builds e pipelines', () => {
  it('reproduz execução, etapas, histórico e eventos permitidos', () => {
    render(<BuildsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Builds' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Android · 2.18.0-rc.3' })).toBeVisible();
    expect(screen.getByLabelText('Etapas persistidas do pipeline')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Histórico recente' })).toBeVisible();
    expect(screen.getByText('Eventos permitidos')).toBeVisible();
    expect(screen.getByText('Build iniciado')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<BuildsPage />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('não transforma URL de artefato não HTTPS em link executável', () => {
    const previous = buildData.builds[0].apk_url;
    buildData.builds[0].apk_url = 'javascript:alert(1)';
    try {
      render(<BuildsPage />);
      expect(screen.getByText('Artefato bloqueado')).toBeVisible();
      expect(screen.queryByRole('link', { name: 'Abrir APK' })).not.toBeInTheDocument();
    } finally {
      buildData.builds[0].apk_url = previous;
    }
  });
});
