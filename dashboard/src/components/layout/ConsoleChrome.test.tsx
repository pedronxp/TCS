// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import type { InternalPermission } from '@/types/internal';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const signOut = vi.fn();
const authState = vi.hoisted(() => ({
  profile: {
    displayName: 'Pedro Paulo',
    role: 'owner' as 'owner' | 'developer',
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
    ] as InternalPermission[],
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: authState.profile,
    can: (permission: InternalPermission) => authState.profile.permissions.includes(permission),
    signOut,
  }),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({ isLoading: false, data: { items: [] } }),
}));

afterEach(() => {
  cleanup();
  signOut.mockClear();
  authState.profile = {
    displayName: 'Pedro Paulo',
    role: 'owner',
    permissions: [
      'dashboard.executive.read', 'customer.read', 'customer.write', 'support.read',
      'commercial.read', 'session.read', 'staff.read', 'audit.read', 'configuration.publish',
    ],
  };
});

describe('Chrome do console', () => {
  it.each([
    ['/app', 'Visão executiva'],
    ['/app/clientes', 'Carteira e implantação'],
    ['/app/clientes/organization%3Aaurora/resumo', 'Detalhe do cliente'],
    ['/app/clientes/organization%3Aaurora/usuarios/user-1/vistorias', 'Detalhe do agente'],
    ['/app/planos', 'Planos e limites'],
    ['/app/assinaturas', 'Assinaturas e ciclos'],
    ['/app/sessoes', 'Sessões e dispositivos'],
    ['/app/suporte', 'Central de atendimento'],
    ['/app/staff', 'Equipe e permissões'],
    ['/app/auditoria', 'Auditoria e eventos'],
    ['/app/desenvolvimento/versoes', 'Versões e canais'],
    ['/app/desenvolvimento/builds', 'Builds e pipelines'],
    ['/app/desenvolvimento/formularios', 'Formulários e versões'],
    ['/app/desenvolvimento/regras-risco', 'Regras e simulação'],
    ['/app/desenvolvimento/sincronizacao', 'Sincronização'],
    ['/app/desenvolvimento/armazenamento', 'Armazenamento'],
    ['/app/desenvolvimento/logs', 'Logs e erros'],
    ['/app/governanca/configuracoes', 'Configurações do console'],
    ['/app/governanca/arquivamento', 'Arquivamento e retenção'],
    ['/app/referencia-ui', 'Interface do produto'],
  ])('mantém contexto visível na rota %s', (path, title) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppHeader onOpenMobile={vi.fn()} density="comfortable" onDensityChange={vi.fn()}
          theme="dark"
          onThemeChange={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('mantém sidebar de 232 px e ações aprovadas no header', () => {
    render(
      <MemoryRouter initialEntries={['/app/clientes']}>
        <AppSidebar collapsed={false} onCollapsedChange={vi.fn()} />
        <AppHeader onOpenMobile={vi.fn()} density="comfortable" onDensityChange={vi.fn()}
          theme="dark"
          onThemeChange={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Navegação do console')).toHaveClass('w-[232px]');
    expect(screen.getAllByRole('link', { name: /Visão executiva/ }).some((link) => link.getAttribute('href') === '/app')).toBe(true);
    expect(screen.getByPlaceholderText('Buscar cliente por nome ou documento…')).toBeVisible();
    expect(screen.getByRole('button', { name: /Novo cliente/ })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Abrir fila de suporte' })).toHaveAttribute('href', '/app/suporte');
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
        <AppHeader onOpenMobile={vi.fn()} density="comfortable" onDensityChange={vi.fn()}
          theme="dark"
          onThemeChange={() => {}} />
      </MemoryRouter>,
    );
    const result = await axe(container);
    expect(result.violations).toEqual([]);
  });

  it('expõe composição técnica e destino real de alertas para developer', () => {
    authState.profile = {
      displayName: 'Daniel Developer',
      role: 'developer',
      permissions: ['dashboard.technical.read', 'technical.read', 'build.request'],
    };
    render(
      <MemoryRouter initialEntries={['/app']}>
        <AppSidebar collapsed={false} onCollapsedChange={vi.fn()} />
        <AppHeader onOpenMobile={vi.fn()} density="comfortable" onDensityChange={vi.fn()}
          theme="dark"
          onThemeChange={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Saúde técnica').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Saúde técnica/ }).some((link) => link.getAttribute('href') === '/app')).toBe(true);
    expect(screen.getByRole('link', { name: 'Abrir alertas técnicos' })).toHaveAttribute('href', '/app/desenvolvimento/logs');
    expect(screen.queryByRole('link', { name: 'Visão executiva' })).not.toBeInTheDocument();
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
