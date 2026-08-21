// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortalPasswordRecoveryPage } from './PortalPasswordRecoveryPage';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  functions: { invoke: vi.fn() },
  auth: { getSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.sessionStorage.clear();
  supabaseMock.rpc.mockReset();
  supabaseMock.functions.invoke.mockReset();
  supabaseMock.auth.getSession.mockReset();
  supabaseMock.auth.updateUser.mockReset();
  supabaseMock.auth.signOut.mockReset();
});

function enableRecovery() {
  supabaseMock.rpc.mockResolvedValue({ data: { password_recovery: true }, error: null });
}

describe('recuperação de senha do portal', () => {
  it('encaminha somente o e-mail para a porta de recuperação do servidor', async () => {
    const user = userEvent.setup();
    enableRecovery();
    supabaseMock.functions.invoke.mockResolvedValue({ data: { accepted: true }, error: null });
    render(<MemoryRouter><PortalPasswordRecoveryPage mode="request" /></MemoryRouter>);

    await user.type(screen.getByLabelText('E-mail'), 'Pessoa@Exemplo.com ');
    await user.click(screen.getByRole('button', { name: 'Enviar link seguro' }));

    expect(await screen.findByText('Verifique seu e-mail')).toBeVisible();
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('password-recovery-request', {
      body: { email: 'pessoa@exemplo.com' },
    });
  });

  it('não envia solicitações quando a capacidade pública está desativada', async () => {
    const user = userEvent.setup();
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'disabled' } });
    render(<MemoryRouter><PortalPasswordRecoveryPage mode="request" /></MemoryRouter>);

    await user.type(screen.getByLabelText('E-mail'), 'pessoa@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link seguro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('temporariamente indisponível');
    expect(supabaseMock.functions.invoke).not.toHaveBeenCalled();
  });

  it('mostra uma mensagem neutra quando o servidor bloqueia excesso de tentativas', async () => {
    const user = userEvent.setup();
    enableRecovery();
    supabaseMock.functions.invoke.mockResolvedValue({ data: null, error: { context: { status: 429 } } });
    render(<MemoryRouter><PortalPasswordRecoveryPage mode="request" /></MemoryRouter>);

    await user.type(screen.getByLabelText('E-mail'), 'pessoa@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link seguro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas de recuperação');
    expect(screen.queryByText('Verifique seu e-mail')).not.toBeInTheDocument();
  });

  it('orienta a solicitar outro link quando a sessão de recovery expirou', async () => {
    vi.useFakeTimers();
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } });
    render(<MemoryRouter initialEntries={['/redefinir-senha?returnTo=%2Fportal']}><PortalPasswordRecoveryPage mode="reset" /></MemoryRouter>);
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(screen.getByRole('alert')).toHaveTextContent('inválido, expirou ou já foi utilizado');
    expect(screen.getByRole('link', { name: 'Solicitar outro link' })).toHaveAttribute('href', '/recuperar-senha?returnTo=%2Fportal');
  });
});
