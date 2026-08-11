// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutReturnPage } from './CheckoutReturnPage';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  refreshAccess: vi.fn(),
  access: { accountKind: 'individual' } as { accountKind: 'individual' | 'organization' } | null,
}));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/contexts/PortalAuthContext', () => ({
  usePortalAuth: () => ({ access: mocks.access, refreshAccess: mocks.refreshAccess }),
}));

function renderPage(withCheckout = true) {
  return render(<MemoryRouter initialEntries={[withCheckout ? '/checkout/retorno?checkout=checkout-123' : '/checkout/retorno']}><CheckoutReturnPage /></MemoryRouter>);
}

beforeEach(() => {
  mocks.access = { accountKind: 'individual' };
  mocks.rpc.mockReset();
  mocks.refreshAccess.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('retorno público de checkout', () => {
  it('não afirma pendência antes da primeira resposta autoritativa', () => {
    mocks.rpc.mockReturnValue(new Promise(() => undefined));
    const { container } = renderPage();
    expect(screen.getByRole('heading', { name: 'Consultando o estado do checkout' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Aguardando o provedor de pagamento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /portal/i })).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toHaveClass('motion-reduce:animate-none');
  });

  it.each([
    ['pending', 'Aguardando o provedor de pagamento'],
    ['completed', 'Pagamento confirmado pelo servidor'],
    ['failed', 'Não foi possível confirmar o checkout'],
    ['expired', 'O prazo deste checkout expirou'],
  ] as const)('preserva o estado %s confirmado pela consulta', async (status, heading) => {
    mocks.rpc.mockResolvedValue({ data: { status }, error: null });
    renderPage();
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
    expect(screen.getByText('checkout-123')).toBeVisible();
    if (status === 'completed') expect(mocks.refreshAccess).toHaveBeenCalledTimes(1);
    else expect(mocks.refreshAccess).not.toHaveBeenCalled();
  });

  it('trata a ausência de referência como falha sem chamar o servidor', async () => {
    renderPage(false);
    expect(await screen.findByRole('heading', { name: 'Não foi possível confirmar o checkout' })).toBeVisible();
    expect(screen.getByText('Não informada')).toBeVisible();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('não afirma que o acesso foi hidratado quando só o checkout foi confirmado', async () => {
    mocks.access = null;
    mocks.rpc.mockResolvedValue({ data: { status: 'completed' }, error: null });
    mocks.refreshAccess.mockRejectedValueOnce(new Error('hydrate_failed'));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Pagamento confirmado pelo servidor' })).toBeVisible();
    expect(screen.getByText(/servidor registrou a confirmação do provedor/i)).toBeVisible();
    expect(screen.queryByText(/contexto de acesso foi atualizado/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir portal' })).toHaveAttribute('href', '/entrar');
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'completed' }, error: null });
    const { container } = renderPage();
    await screen.findByRole('heading', { name: 'Pagamento confirmado pelo servidor' });
    expect((await axe(container)).violations).toEqual([]);
  });
});
