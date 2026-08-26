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
  rpc: vi.fn(),
  invoke: vi.fn(),
  open: vi.fn(),
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

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: state.rpc,
    functions: { invoke: state.invoke },
  },
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
  state.rpc.mockReset();
  state.invoke.mockReset();
  state.open.mockReset();
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: state.writeText } });
  vi.stubGlobal('open', state.open);
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

  it('apresenta ciência pendente com coleta web e geração de link externo', () => {
    state.queryData.items = [{
      id: 'ack-1', title: 'TCS-001', subtitle: 'Morador da rua Um', status: 'pending', link_url: 'https://portal.tcs.test/ciencia/token-1',
    }];
    renderPage();
    expect(screen.getByText('Pendente')).toBeVisible();
    expect(screen.getByRole('button', { name: /Coletar pela web/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Gerar link externo/i })).toBeEnabled();
  });

  it('apresenta link enviado com Copiar link e Revogar link', async () => {
    state.queryData.items = [{
      id: 'ack-2', title: 'TCS-002', subtitle: 'Responsável pelo imóvel', status: 'link_sent', link_url: 'https://portal.tcs.test/ciencia/token-2', can_revoke: true,
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

  it('apresenta recusada como resultado final sem emitir outro link para a mesma versão', () => {
    state.queryData.items = [{
      id: 'ack-4', title: 'TCS-004', subtitle: 'Recusa registrada', status: 'refused', reason: 'Documento não corresponde ao imóvel.',
    }];
    renderPage();
    expect(screen.getByText('Recusada')).toBeVisible();
    expect(screen.getByText(/Documento não corresponde ao imóvel/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Emitir novo link/i })).not.toBeInTheDocument();
  });

  it('apresenta impossibilidade de assinar como resultado final', () => {
    state.queryData.items = [{
      id: 'ack-5', title: 'TCS-005', subtitle: 'Impossibilidade registrada', status: 'unable_to_sign', reason: 'Destinatário não alfabetizado.',
    }];
    renderPage();
    expect(screen.getByText('Impossível assinar')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Emitir novo link/i })).not.toBeInTheDocument();
  });

  it('gera e copia um link remoto usando o contrato autorizado do portal', async () => {
    const token = 'a'.repeat(64);
    state.rpc.mockResolvedValue({ data: { ok: true, token, expires_at: '2026-08-29T12:00:00.000Z' }, error: null });
    state.queryData.items = [{
      id: 'ack-6', title: 'TCS-006', subtitle: 'Pendente', status: 'pending',
    }];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Gerar link externo/i }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('portal_create_document_acknowledgement_link', {
      p_document_id: 'ack-6',
      p_expires_in_hours: 72,
    }));
    await waitFor(() => expect(state.writeText).toHaveBeenCalledWith(`${window.location.origin}/ciencia/${token}`));
    expect(await screen.findByText(new RegExp(token))).toBeVisible();
  });

  it('abre a coleta presencial em nova aba sem marcar ciência pelo agente', async () => {
    const token = 'b'.repeat(64);
    state.rpc.mockResolvedValue({ data: { ok: true, token, expires_at: '2026-08-29T12:00:00.000Z' }, error: null });
    state.queryData.items = [{ id: 'ack-web', title: 'TCS-WEB', subtitle: 'Pendente', status: 'pending' }];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Coletar pela web/i }));
    await waitFor(() => expect(state.open).toHaveBeenCalledWith(
      `${window.location.origin}/ciencia/${token}`,
      '_blank',
      'noopener,noreferrer',
    ));
  });

  it('revoga um link aberto mesmo sem guardar o token puro na listagem', async () => {
    state.rpc.mockResolvedValue({ data: { ok: true, document_id: 'ack-revoke', revoked: true }, error: null });
    state.queryData.items = [{
      id: 'ack-revoke', title: 'TCS-REV', subtitle: 'Link aberto', status: 'link_sent', can_revoke: true,
    }];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Revogar link/i }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('portal_revoke_document_acknowledgement_link', {
      p_document_id: 'ack-revoke',
    }));
    expect(await screen.findByText(/Link de ciência revogado/i)).toBeVisible();
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

  it('mantém a revogação disponível quando a assinatura bloqueia novas emissões', () => {
    state.access.subscriptionStatus = 'canceled';
    state.access.creationAllowed = false;
    state.access.restrictionCause = 'subscription_inactive';
    state.queryData.items = [{
      id: 'ack-safe-revoke', title: 'TCS-SAFE', subtitle: 'Link aberto', status: 'link_sent', can_revoke: true,
    }];
    renderPage();
    expect(screen.getByRole('button', { name: /Revogar link/i })).toBeEnabled();
  });

  it('não apresenta violações automatizadas de acessibilidade no estado vazio', async () => {
    const { container } = renderPage();
    expect((await axe(container)).violations).toEqual([]);
  });
});
