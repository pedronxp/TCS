// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortalPasswordRecoveryPage } from './PortalPasswordRecoveryPage';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
  auth: {
    getSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.sessionStorage.clear();
  supabaseMock.rpc.mockReset();
  supabaseMock.auth.getSession.mockReset();
  supabaseMock.auth.resetPasswordForEmail.mockReset();
  supabaseMock.auth.updateUser.mockReset();
  supabaseMock.auth.signOut.mockReset();
});

describe('recuperação de senha do portal', () => {
  it('envia resposta neutra e preserva a rota de retorno no link seguro', async () => {
    const user = userEvent.setup();
    supabaseMock.rpc.mockResolvedValue({ data: { password_recovery: true }, error: null });
    supabaseMock.auth.resetPasswordForEmail.mockResolvedValue({ error: null });

    render(
      <MemoryRouter initialEntries={['/recuperar-senha?returnTo=%2Fportal%2Fagenda']}>
        <PortalPasswordRecoveryPage mode="request" />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('E-mail'), 'Pessoa@Exemplo.com ');
    await user.click(screen.getByRole('button', { name: 'Enviar link seguro' }));

    expect(await screen.findByText('Verifique seu e-mail')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Se existir uma conta elegível');
    expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith('pessoa@exemplo.com', {
      redirectTo: 'http://localhost:3000/redefinir-senha?returnTo=%2Fportal%2Fagenda',
    });
    screen.getAllByRole('link', { name: 'Voltar ao login' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/entrar?returnTo=%2Fportal%2Fagenda');
    });
  });

  it('expõe indisponibilidade real sem simular envio', async () => {
    const user = userEvent.setup();
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'disabled' } });
    render(<MemoryRouter><PortalPasswordRecoveryPage mode="request" /></MemoryRouter>);

    await user.type(screen.getByLabelText('E-mail'), 'pessoa@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link seguro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('temporariamente indisponível');
    expect(supabaseMock.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('mantém o formulário e mostra erro genérico quando o envio falha', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    supabaseMock.rpc.mockResolvedValue({ data: { password_recovery: true }, error: null });
    supabaseMock.auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: 'SMTP provider rejected the request' },
    });
    render(<MemoryRouter><PortalPasswordRecoveryPage mode="request" /></MemoryRouter>);

    await user.type(screen.getByLabelText('E-mail'), 'pessoa@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar link seguro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível solicitar a recuperação agora');
    expect(screen.queryByText('Verifique seu e-mail')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar link seguro' })).toBeEnabled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[password-recovery] resetPasswordForEmail failed:',
      'SMTP provider rejected the request',
      expect.objectContaining({ message: 'SMTP provider rejected the request' }),
    );
    consoleErrorSpy.mockRestore();
  });

  it('orienta a solicitar outro link quando a sessão de recovery expirou', async () => {
    vi.useFakeTimers();
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } });
    render(
      <MemoryRouter initialEntries={['/redefinir-senha?returnTo=%2Fportal']}>
        <PortalPasswordRecoveryPage mode="reset" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Validando sua sessão');
    // O polling roda a cada 200ms até maxAttempts (15 * 200ms = 3s). Como session é
    // null e sessionStorage está vazio, verify() retorna "null" (aguardando) até
    // atingir maxAttempts, onde para com false.
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });

    expect(screen.getByRole('alert')).toHaveTextContent('inválido, expirou ou já foi utilizado');
    expect(screen.getByRole('link', { name: 'Solicitar outro link' })).toHaveAttribute('href', '/recuperar-senha?returnTo=%2Fportal');
    vi.useRealTimers();
  });

  it('valida senha e confirmação antes de chamar o Supabase', async () => {
    vi.useFakeTimers();
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    window.sessionStorage.setItem('tcs.portal.password-recovery', JSON.stringify({
      userId: 'user-1',
      expiresAt: Date.now() + 60_000,
    }));
    render(<MemoryRouter><PortalPasswordRecoveryPage mode="reset" /></MemoryRouter>);
    await act(async () => { await vi.advanceTimersByTimeAsync(201); });
    vi.useRealTimers();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Nova senha'), 'senha-123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'outra-123');
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(screen.getByRole('alert')).toHaveTextContent('confirme a mesma senha');
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
  });
});
