// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthCallbackPage } from './AuthCallbackPage';

const accountEntry = vi.hoisted(() => ({
  resolveAuthCallbackSession: vi.fn(),
  resolveAuthenticatedAccountEntry: vi.fn(),
}));

vi.mock('@/lib/account-entry', () => accountEntry);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  accountEntry.resolveAuthCallbackSession.mockReset();
  accountEntry.resolveAuthenticatedAccountEntry.mockReset();
});

describe('tela intermediária de autenticação TCS', () => {
  it('mantém o retorno Google visível até concluir a identificação da conta', async () => {
    vi.useFakeTimers();
    accountEntry.resolveAuthCallbackSession.mockResolvedValue({
      user: { id: 'customer-1' },
    });
    accountEntry.resolveAuthenticatedAccountEntry.mockResolvedValue({
      kind: 'individual',
      destination: '/portal/individual',
      label: 'Portal profissional individual',
    });

    render(
      <MemoryRouter initialEntries={['/auth/callback?source=portal&provider=google']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/portal/individual" element={<p>Portal individual aberto</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Conectando ao Google' })).toBeVisible();
    expect(screen.getByText('Confirmar a autorização da conta Google')).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    expect(screen.getByText('Preparando portal profissional individual para você.')).toBeVisible();
    expect(screen.queryByText('Portal individual aberto')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1350);
    });

    expect(screen.getByText('Portal individual aberto')).toBeVisible();
  });

  it('informa falhas de sessão e preserva o retorno correto para o Console', async () => {
    accountEntry.resolveAuthCallbackSession.mockRejectedValue(new Error('Sua sessão expirou.'));

    render(
      <MemoryRouter initialEntries={['/auth/callback?source=console']}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Sua sessão expirou.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Voltar e tentar novamente' })).toHaveAttribute('href', '/login');
  });
});
