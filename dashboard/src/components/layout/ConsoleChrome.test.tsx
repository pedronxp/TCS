// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const signOut = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      displayName: 'Pedro Paulo',
      role: 'owner',
      permissions: [
        'dashboard.executive.read',
        'customer.read',
        'customer.write',
        'support.read',
        'commercial.read',
        'session.read',
        'staff.read',
        'audit.read',
        'configuration.publish',
      ],
    },
    can: () => true,
    signOut,
  }),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({ isLoading: false, data: { items: [] } }),
}));

afterEach(() => {
  cleanup();
  signOut.mockClear();
});

describe('Chrome do console', () => {
  it('mantém sidebar de 232 px e ações aprovadas no header', () => {
    render(
      <MemoryRouter initialEntries={['/app/clientes']}>
        <AppSidebar collapsed={false} onCollapsedChange={vi.fn()} />
        <AppHeader onOpenMobile={vi.fn()} density="comfortable" onDensityChange={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Navegação do console')).toHaveClass('w-[232px]');
    expect(screen.getByRole('link', { name: /Visão executiva/ })).toBeVisible();
    expect(screen.getByPlaceholderText('Buscar cliente por nome ou documento…')).toBeVisible();
    expect(screen.getByRole('button', { name: /Novo cliente/ })).toBeVisible();
  });

  it('mantém navegação recolhida com área de toque confortável', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <AppSidebar collapsed onCollapsedChange={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Navegação do console')).toHaveClass('w-[88px]');
    expect(screen.getByRole('button', { name: 'Expandir navegação' })).toHaveClass('h-[34px]', 'w-[34px]');
    expect(screen.getByRole('link', { name: 'Visão executiva' })).toHaveClass('h-12', 'w-12');
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/app/clientes']}>
        <AppSidebar collapsed={false} onCollapsedChange={vi.fn()} />
        <AppHeader onOpenMobile={vi.fn()} density="comfortable" onDensityChange={vi.fn()} />
      </MemoryRouter>,
    );
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('encerra a sessão pela navegação do console', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/app']}>
        <AppSidebar collapsed={false} onCollapsedChange={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
