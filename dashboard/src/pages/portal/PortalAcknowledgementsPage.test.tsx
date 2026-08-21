// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { PortalAcknowledgementsPage } from './PortalAcknowledgementsPage';
import type { PortalAccessContext, PortalPermission } from '@/types/portal';

const state = vi.hoisted(() => ({
  access: {
    accountKind: 'organization' as const,
    userId: 'user-1',
    displayName: 'Coordenação TCS',
    organizationId: 'org-1',
    organizationName: 'Município Piloto',
    role: 'master' as const,
    membershipStatus: 'active' as const,
    subscriptionStatus: 'active' as const,
    cancelAtPeriodEnd: false,
    planId: 'plan-1',
    planVersionId: 'version-1',
    planName: 'Municipal Básico',
    features: {},
    limits: {},
    usage: { inspections: 0 },
    permissions: ['dashboard.read', 'inspection.read', 'document.read'],
    creationAllowed: true,
    restrictionCause: null,
  } as PortalAccessContext,
  queryData: { items: [] as Array<Record<string, unknown>>, summary: {} },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  writeText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: state.queryData,
    isLoading: state.isLoading,
    isFetching: false,
    isError: state.isError,
    refetch: state.refetch,
  }),
}));

vi.mock('@/contexts/PortalAuthContext', () => ({
  usePortalAuth: () => ({ access: state.access, can: (permission: string) => state.access.permissions.includes(permission as PortalPermission) }),
}));

vi.mock('@/lib/portal', () => ({
  fetchPortalWorkspace: vi.fn(),
  portalRestrictionMessage: (cause: string | null) => cause ?? '',
}));

beforeEach(() => {
  state.queryData = { items: [], summary: {} };
  state.isLoading = false;
  state.isError = false;
  state.access.creationAllowed = true;
  state.access.restrictionCause = null;
  state.access.subscriptionStatus = 'active';
  state.refetch.mockReset();
  state.writeText.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: state.writeText } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/portal/municipal/ciencias']}>
      <PortalAcknowledgementsPage />
    </MemoryRouter>,
  );
}

describe('gestão municipal de ciências', () => {
  it('mostra estado vazio quando não há ciências', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Nenhuma ciência registrada' })).toBeVisible();
  });

  it('mostra estado de carregamento enquanto busca ciências', () => {
    state.isLoading = true;
    renderPage();
    expect(screen.getByRole('status', { name: 'Carregando ciências' })).toBeInTheDocument();
  });

  it('mostra estado de erro e permite tentar novamente', () => {
    state.isError = true;
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as ciências');
    expect(screen.getAllByRole('button', { name: 'Tentar novamente' }).length).toBeGreaterThan(0);
  });

  it('apresenta ciência pendente com Retomar ciência e Gerar link externo', () => {
    state.queryData.items = [{
      id: 'ack-1', title: 'TCS-001', subtitle: 'Morador da rua Um', status: 'pending', link_url: 'https://portal.tcs.test/ciencia/token-1',
    }];
    renderPage();
    expect(screen.getByText('Pendente')).toBeVisible();
    expect(screen.getByRole('button', { name: /Retomar ciência/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Gerar link externo/i })).toBeEnabled();
  });

  it('apresenta link enviado com Copiar link e Revogar link', async () => {
    state.queryData.items = [{
      id: 'ack-2', title: 'TCS-002', subtitle: 'Responsável pelo imóvel', status: 'link_sent', link_url: 'https://portal.tcs.test/ciencia/token-2',
    }];
    renderPage();
    expect(screen.getByText('Link enviado')).toBeVisible();
    const revokeButton = screen.getByRole('button', { name: /Revogar link/i });
    expect(revokeButton).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Copiar link/i }));
    await waitFor(() => expect(state.writeText).toHaveBeenCalledWith('https://portal.tcs.test/ciencia/token-2'));
  });

  it('oculta emissão de link quando a ciência está concluída e expõe evidências autorizadas', () => {
    state.queryData.items = [{
      id: 'ack-3', acknowledgement_id: '00000000-0000-0000-0000-000000000003', title: 'TCS-003', subtitle: 'Ciência concluída', status: 'acknowledged', document_available: true, signature_available: true,
    }];
    renderPage();
    expect(screen.getByText('Concluída')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Gerar link externo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Visualizar documento/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Baixar assinatura/i })).toBeEnabled();
  });

  it('apresenta recusada com motivo e Emitir novo link', () => {
    state.queryData.items = [{
      id: 'ack-4', title: 'TCS-004', subtitle: 'Recusa registrada', status: 'refused', reason: 'Documento não corresponde ao imóvel.',
    }];
    renderPage();
    expect(screen.getByText('Recusada')).toBeVisible();
    expect(screen.getByText(/Documento não corresponde ao imóvel/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /Emitir novo link/i })).toBeEnabled();
  });

  it('apresenta impossibilidade de assinar e oferece Emitir novo link', () => {
    state.queryData.items = [{
      id: 'ack-5', title: 'TCS-005', subtitle: 'Impossibilidade registrada', status: 'unable_to_sign', reason: 'Destinatário não alfabetizado.',
    }];
    renderPage();
    expect(screen.getByText('Impossível assinar')).toBeVisible();
    expect(screen.getByRole('button', { name: /Emitir novo link/i })).toBeEnabled();
  });

  it('sinaliza que geração e revogação de link ainda não estão disponíveis no backend', async () => {
    state.queryData.items = [{
      id: 'ack-6', title: 'TCS-006', subtitle: 'Pendente', status: 'pending',
    }];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Gerar link externo/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A geração e revogação de links de ciência ainda não estão disponíveis');
  });

  it('desabilita emissão de link quando a assinatura bloqueia a criação', () => {
    state.access.subscriptionStatus = 'canceled';
    state.access.creationAllowed = false;
    state.access.restrictionCause = 'subscription_inactive';
    state.queryData.items = [{
      id: 'ack-7', title: 'TCS-007', subtitle: 'Pendente bloqueado', status: 'pending',
    }];
    renderPage();
    expect(screen.getByText(/A gestão de ciências está em consulta/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /Gerar link externo/i })).toBeDisabled();
  });

  it('não apresenta violações automatizadas de acessibilidade no estado vazio', async () => {
    const { container } = renderPage();
    expect((await axe(container)).violations).toEqual([]);
  });
});
