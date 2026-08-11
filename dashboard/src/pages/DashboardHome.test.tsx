// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardHome, type DashboardData } from './DashboardHome';
import type { InternalPermission } from '@/types/internal';

const executiveData: DashboardData = {
  kind: 'executive',
  metrics: [
    { key: 'customers', label: 'Clientes', value: 148 },
    { key: 'subscriptions', label: 'Assinaturas vigentes', value: 132 },
    { key: 'renewals', label: 'Renovações em 30 dias', value: 12 },
    { key: 'past_due', label: 'Assinaturas em risco', value: 4 },
    { key: 'support', label: 'Chamados abertos', value: 7 },
    { key: 'sla', label: 'SLAs violados', value: 1 },
    { key: 'onboarding', label: 'Implantações em curso', value: 3 },
  ],
  attention: [{
    type: 'renewal',
    label: 'Prefeitura de Aurora',
    detail: 'Plano Gestão',
    status: 'past_due',
    customerId: 'organization:aurora',
    dueAt: '2026-08-12T12:00:00Z',
  }],
  release: null,
};

const technicalData: DashboardData = {
  kind: 'technical',
  metrics: [
    { key: 'builds_running', label: 'Builds em execução', value: 2 },
    { key: 'builds_failed', label: 'Builds com falha (7d)', value: 1 },
    { key: 'sync', label: 'Falhas de sincronização (24h)', value: 3 },
    { key: 'storage', label: 'Falhas de armazenamento (24h)', value: 2 },
    { key: 'errors', label: 'Erros críticos (24h)', value: 4 },
  ],
  attention: [{
    type: 'technical',
    label: 'Falha ao sincronizar lote',
    detail: 'sync · android',
    status: 'critical',
    customerId: 'organization:aurora',
    dueAt: null,
  }],
  release: { published: '2.17.0', minimum: '2.16.4', development: '2.18.0-beta.2' },
};

const queryState = vi.hoisted(() => ({
  data: null as DashboardData | null,
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
  options: null as { queryKey?: readonly unknown[]; enabled?: boolean } | null,
}));

const authState = vi.hoisted(() => ({
  profile: {
    userId: 'owner-user',
    displayName: 'Pedro Paulo',
    role: 'owner' as 'owner' | 'developer',
    permissions: ['dashboard.executive.read', 'customer.read', 'commercial.read', 'support.read'] as InternalPermission[],
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey?: readonly unknown[]; enabled?: boolean }) => {
    queryState.options = options;
    return queryState;
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: authState.profile,
    can: (permission: InternalPermission) => authState.profile.permissions.includes(permission),
  }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));

afterEach(() => {
  cleanup();
  queryState.data = executiveData;
  queryState.isLoading = false;
  queryState.isError = false;
  queryState.isFetching = false;
  queryState.refetch.mockReset();
  queryState.options = null;
  authState.profile = {
    userId: 'owner-user',
    displayName: 'Pedro Paulo',
    role: 'owner',
    permissions: ['dashboard.executive.read', 'customer.read', 'commercial.read', 'support.read'],
  };
});

describe('painel interno por perfil', () => {
  it('prioriza decisões executivas com métricas e ações reais permitidas', () => {
    queryState.data = executiveData;
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'O que exige decisão agora' })).toBeVisible();
    expect(screen.getByText('Perfil owner')).toBeVisible();
    expect(screen.getByText('Clientes')).toBeVisible();
    expect(screen.getByText('Assinaturas em risco')).toBeVisible();
    expect(screen.getByText('Prefeitura de Aurora')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/app/clientes/organization%3Aaurora');
    expect(screen.getByRole('link', { name: /Abrir clientes/ })).toHaveAttribute('href', '/app/clientes');
    expect(screen.getByRole('link', { name: /Revisar assinaturas/ })).toHaveAttribute('href', '/app/assinaturas');
    expect(screen.queryByRole('link', { name: /Consultar auditoria/ })).not.toBeInTheDocument();
    expect(queryState.options?.queryKey).toEqual(['internal-dashboard', 'owner-user', 'owner']);
  });

  it('torna saúde técnica e releases inequívocos para developer', () => {
    authState.profile = {
      userId: 'developer-user',
      displayName: 'Daniel Developer',
      role: 'developer',
      permissions: ['dashboard.technical.read', 'technical.read', 'build.request', 'audit.read'],
    };
    queryState.data = technicalData;
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'O que exige investigação agora' })).toBeVisible();
    expect(screen.getByText('Perfil developer')).toBeVisible();
    expect(screen.getByText('Builds com falha (7d)')).toBeVisible();
    expect(screen.getByText('Referência de versões')).toBeVisible();
    expect(screen.getByText('2.17.0')).toBeVisible();
    expect(screen.getByText('2.18.0-beta.2')).toBeVisible();
    expect(screen.getByText('Falha ao sincronizar lote')).toBeVisible();
    expect(screen.getByRole('link', { name: /Abrir builds/ })).toHaveAttribute('href', '/app/desenvolvimento/builds');
    expect(screen.queryByRole('link', { name: /Revisar assinaturas/ })).not.toBeInTheDocument();
    expect(queryState.options?.queryKey).toEqual(['internal-dashboard', 'developer-user', 'developer']);
  });

  it('não oferece destino de suporte sem support.read', () => {
    authState.profile.permissions = ['dashboard.executive.read'];
    queryState.data = {
      ...executiveData,
      attention: [{
        type: 'support',
        label: 'TCS-204 · Retorno pendente',
        detail: 'Conta individual',
        status: 'high',
        customerId: 'user:restricted',
        dueAt: null,
      }],
    };

    render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    expect(screen.queryByRole('link', { name: 'Abrir' })).not.toBeInTheDocument();
    expect(screen.getByText('Seu perfil pode acompanhar este alerta, mas não tem acesso ao módulo correspondente.')).toBeVisible();
  });

  it('não oferece logs técnicos sem technical.read', () => {
    authState.profile = {
      userId: 'developer-restricted',
      displayName: 'Dev Restrito',
      role: 'developer',
      permissions: ['dashboard.technical.read'],
    };
    queryState.data = technicalData;

    render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    expect(screen.queryByRole('link', { name: 'Abrir' })).not.toBeInTheDocument();
    expect(screen.getByText('Seu perfil pode acompanhar este alerta, mas não tem acesso ao módulo correspondente.')).toBeVisible();
  });

  it('renderiza todas as prioridades retornadas pelo limite do RPC', () => {
    queryState.data = {
      ...executiveData,
      attention: Array.from({ length: 10 }, (_, index) => ({
        type: 'renewal',
        label: `Prioridade ${index + 1}`,
        detail: null,
        status: 'past_due',
        customerId: `organization:${index + 1}`,
        dueAt: null,
      })),
    };

    render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    expect(screen.getByText('Prioridade 1')).toBeVisible();
    expect(screen.getByText('Prioridade 9')).toBeVisible();
    expect(screen.getByText('Prioridade 10')).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Abrir' })).toHaveLength(10);
  });

  it('mantém skeleton estável e respeita reduced-motion', () => {
    queryState.data = null;
    queryState.isLoading = true;
    const { container } = render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    expect(screen.getByRole('status', { name: 'Carregando painel interno' })).toBeVisible();
    expect(Array.from(container.querySelectorAll('[class]')).filter((item) => item.classList.contains('h-[148px]'))).toHaveLength(7);
    container.querySelectorAll('.animate-pulse').forEach((item) => expect(item).toHaveClass('motion-reduce:animate-none'));
  });

  it('expõe falha honesta e permite nova tentativa', async () => {
    const user = userEvent.setup();
    queryState.data = null;
    queryState.isError = true;
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    expect(screen.getByRole('alert')).toHaveTextContent('não foram substituídos por estimativas');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(queryState.refetch).toHaveBeenCalledOnce();
  });

  it('não transforma resposta vazia em estado saudável', () => {
    queryState.data = { kind: 'executive', metrics: [], attention: [], release: null };
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    expect(screen.getByText('Indicadores ainda não disponíveis')).toBeVisible();
    expect(screen.getByText(/Nenhuma prioridade foi retornada/)).toBeVisible();
    expect(screen.queryByText(/tudo certo|sem riscos/i)).not.toBeInTheDocument();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    queryState.data = executiveData;
    const { container } = render(<MemoryRouter><DashboardHome /></MemoryRouter>);
    expect((await axe(container)).violations).toEqual([]);
  });
});
