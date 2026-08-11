// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteAcceptancePage } from './InviteAcceptancePage';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  refreshAccess: vi.fn(),
  navigate: vi.fn(),
  session: null as object | null,
}));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/contexts/PortalAuthContext', () => ({
  usePortalAuth: () => ({ session: mocks.session, refreshAccess: mocks.refreshAccess }),
}));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

function renderPage(token = 'invite-token') {
  return render(
    <MemoryRouter initialEntries={[`/convite/${token}`]}>
      <Routes><Route path="/convite/:token" element={<InviteAcceptancePage />} /></Routes>
    </MemoryRouter>,
  );
}

const readyPreview = {
  organization_name: 'Defesa Civil de Santos',
  email_hint: 'pe***@santos.sp.gov.br',
  role: 'agent',
  expires_at: '2026-08-10T18:00:00.000Z',
  status: 'pending',
};

beforeEach(() => {
  mocks.session = null;
  mocks.rpc.mockReset();
  mocks.refreshAccess.mockReset().mockResolvedValue(undefined);
  mocks.navigate.mockReset();
});

afterEach(cleanup);

describe('aceite público de convite municipal', () => {
  it('distingue o carregamento antes da validação do servidor', () => {
    mocks.rpc.mockReturnValue(new Promise(() => undefined));
    const { container } = renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Validando convite seguro');
    expect(screen.queryByRole('button', { name: /aceitar convite/i })).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toHaveClass('motion-reduce:animate-none');
  });

  it.each([
    [{ data: null, error: null }, 'Convite inválido'],
    [{ data: { status: 'expired' }, error: null }, 'Convite expirado'],
    [{ data: { ...readyPreview, status: 'accepted' }, error: null }, 'Convite já utilizado'],
    [{ data: { ...readyPreview, status: 'revoked' }, error: null }, 'Convite revogado'],
  ])('apresenta o estado terminal correspondente', async (response, heading) => {
    mocks.rpc.mockResolvedValue(response);
    renderPage();
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
    expect(screen.queryByRole('button', { name: /aceitar convite/i })).not.toBeInTheDocument();
  });

  it('mostra os dados auditáveis antes de pedir autenticação', async () => {
    mocks.rpc.mockResolvedValue({ data: readyPreview, error: null });
    renderPage();
    expect(await screen.findByText('Defesa Civil de Santos')).toBeVisible();
    expect(screen.getByText('pe***@santos.sp.gov.br')).toBeVisible();
    expect(screen.getByText('Agente')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Entrar com o e-mail do convite' })).toHaveAttribute('href', '/entrar?returnTo=%2Fconvite%2Finvite-token');
  });

  it.each([
    ['coordinator', 'Coordenador'],
    ['supervisor', 'Supervisor'],
    ['agent', 'Agente'],
  ])('traduz o papel contratual %s', async (role, label) => {
    mocks.rpc.mockResolvedValue({ data: { ...readyPreview, role }, error: null });
    renderPage();
    expect(await screen.findByText(label)).toBeVisible();
  });

  it('respeita movimento reduzido durante o aceite', async () => {
    mocks.session = { user: { id: 'user-1' } };
    mocks.rpc
      .mockResolvedValueOnce({ data: readyPreview, error: null })
      .mockReturnValueOnce(new Promise(() => undefined));
    const { container } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Aceitar convite e criar vínculo' }));
    expect(screen.getByRole('button', { name: /confirmando vínculo/i })).toBeDisabled();
    expect(container.querySelector('.animate-spin')).toHaveClass('motion-reduce:animate-none');
  });

  it('só apresenta sucesso após o aceite confirmado pelo servidor', async () => {
    mocks.session = { user: { id: 'user-1' } };
    mocks.rpc
      .mockResolvedValueOnce({ data: readyPreview, error: null })
      .mockResolvedValueOnce({ data: { accepted: true }, error: null });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Aceitar convite e criar vínculo' }));
    expect(await screen.findByRole('heading', { name: 'Convite aceito' })).toBeVisible();
    expect(mocks.refreshAccess).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir portal municipal' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/portal/municipal', { replace: true });
  });

  it('mantém o aceite confirmado quando apenas a atualização local do acesso falha', async () => {
    mocks.session = { user: { id: 'user-1' } };
    mocks.rpc
      .mockResolvedValueOnce({ data: readyPreview, error: null })
      .mockResolvedValueOnce({ data: { accepted: true }, error: null });
    mocks.refreshAccess.mockRejectedValueOnce(new Error('refresh_failed'));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Aceitar convite e criar vínculo' }));

    expect(await screen.findByRole('heading', { name: 'Convite aceito' })).toBeVisible();
    expect(screen.getByText(/confirmado pelo servidor/i)).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(/navegador ainda não atualizou o acesso/i);
    expect(screen.getByRole('link', { name: 'Recarregar e abrir portal municipal' })).toHaveAttribute('href', '/portal/municipal');
    expect(screen.queryByRole('heading', { name: 'Convite não aceito' })).not.toBeInTheDocument();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    mocks.rpc.mockResolvedValue({ data: readyPreview, error: null });
    const { container } = renderPage();
    await screen.findByText('Defesa Civil de Santos');
    expect((await axe(container)).violations).toEqual([]);
  });
});
