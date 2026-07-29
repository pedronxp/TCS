// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArquivamentoPage } from './ArquivamentoPage';

const lifecycle = {
  config: { mode: 'manual', enabled: true, daysThreshold: 7 },
  pending: [{
    id: 'inspection-pending',
    protocol: 'TCS-001',
    municipality: 'Campinas',
    risk: 'R2',
    inspectionAt: '2026-07-01T12:00:00.000Z',
    storageLocation: 'supabase',
  }],
  history: [{
    id: 'inspection-drive',
    protocol: 'TCS-002',
    municipality: 'Santos',
    risk: 'R3',
    inspectionAt: '2026-06-01T12:00:00.000Z',
    storageLocation: 'drive',
    archivedAt: '2026-07-10T12:00:00.000Z',
    manifestVerified: true,
  }],
  restoreRequests: [{
    id: 'request-1',
    batchId: 'batch-1',
    inspectionId: 'inspection-drive',
    protocol: 'TCS-002',
    municipality: 'Santos',
    status: 'pending',
    reason: 'Atendimento ao processo administrativo',
    requiresSecondApproval: true,
    requestedBy: 'owner-2',
    requestedByName: 'Owner solicitante',
    requestedAt: '2026-07-26T12:00:00.000Z',
    approvedByName: null,
    attemptCount: 0,
    lastError: null,
    completedAt: null,
  }],
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: lifecycle, isLoading: false, error: null, refetch: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' }, profile: { assuranceLevel: 'aal2' }, refreshAssurance: vi.fn() }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

afterEach(cleanup);

describe('Arquivamento e restauração', () => {
  it('apresenta retenção, proteção e fila persistente', () => {
    render(<ArquivamentoPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Arquivamento' })).toBeVisible();
    expect(screen.getByText('Restauração protegida')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Arquivar (1)' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Fila (1)' })).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<ArquivamentoPage />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
