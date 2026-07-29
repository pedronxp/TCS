// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '@/pages/LoginPage';
import { ProtectedRoute } from './ProtectedRoute';

const authState = vi.hoisted(() => ({
  loading: false,
  isAuthorized: false,
  signIn: vi.fn(),
  can: vi.fn(() => true),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

function LoginDestinationProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  return <p>Retorno: {from?.pathname}{from?.search}</p>;
}

afterEach(() => {
  cleanup();
  authState.isAuthorized = false;
  authState.loading = false;
});

describe('navegação pública e autenticada', () => {
  it('protege deep links e preserva o destino completo para o login', () => {
    render(
      <MemoryRouter initialEntries={['/app/clientes/organization%3Aaurora?tab=usuarios']}>
        <Routes>
          <Route path="/login" element={<LoginDestinationProbe />} />
          <Route path="/app/*" element={<ProtectedRoute><p>Console privado</p></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Retorno: /app/clientes/organization%3Aaurora?tab=usuarios')).toBeVisible();
    expect(screen.queryByText('Console privado')).not.toBeInTheDocument();
  });

  it('devolve a sessão autenticada ao deep link protegido solicitado', () => {
    authState.isAuthorized = true;

    render(
      <MemoryRouter initialEntries={[{
        pathname: '/login',
        state: { from: { pathname: '/app/clientes/organization%3Aaurora', search: '?tab=usuarios' } },
      }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app/clientes/:customerId" element={<p>Detalhe autenticado</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Detalhe autenticado')).toBeVisible();
  });
});
