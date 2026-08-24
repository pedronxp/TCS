// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const authState = vi.hoisted(() => ({
  signIn: vi.fn().mockResolvedValue({ error: null }),
  signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
  isAuthorized: false,
  loading: false,
  authMessage: null as string | null,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

afterEach(() => {
  cleanup();
  authState.signIn.mockReset().mockResolvedValue({ error: null });
  authState.signInWithGoogle.mockReset().mockResolvedValue({ error: null });
  authState.authMessage = null;
});

describe('Login interno', () => {
  it('mantém apenas as ações do Console e permite exibir a senha', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    const password = screen.getByLabelText('Senha');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Exibir senha' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Entrar na TCS Console' })).toBeVisible();
    expect(screen.queryByText('Não faz parte da equipe interna TCS?')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Entrar no Portal TCS/ })).not.toBeInTheDocument();
    const google = screen.getByRole('button', { name: 'Entrar ou criar conta com Google' });
    await user.click(google);
    expect(authState.signInWithGoogle).toHaveBeenCalledOnce();
  });

  it('expõe o erro real de autenticação em um alerta acessível', async () => {
    const user = userEvent.setup();
    authState.signIn.mockResolvedValue({ error: 'Credenciais inválidas.' });
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('E-mail'), 'pessoa@tcs.app');
    await user.type(screen.getByLabelText('Senha'), 'senha-invalida');
    await user.click(screen.getByRole('button', { name: 'Entrar na TCS Console' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciais inválidas.');
    await waitFor(() => expect(authState.signIn).toHaveBeenCalledWith('pessoa@tcs.app', 'senha-invalida'));
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<MemoryRouter><LoginPage /></MemoryRouter>);
    const result = await axe(container);
    expect(result.violations).toEqual([]);
  });

  it('usa o token de contraste aprovado no rodapé do painel', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    expect(screen.getByText('Sessão protegida e acesso conforme sua função')).toHaveClass('text-muted-foreground');
    expect(screen.queryByText('Manter sessão neste dispositivo')).not.toBeInTheDocument();
  });
});
