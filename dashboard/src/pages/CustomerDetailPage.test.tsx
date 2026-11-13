// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomerDetailPage } from './CustomerDetailPage';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const now = new Date().toISOString();
const detail = {
  customer: {
    customer_id: 'organization:aurora',
    subject_id: 'organization-1',
    kind: 'organization' as const,
    display_name: 'Prefeitura de Aurora',
    legal_name: 'Município de Aurora',
    municipality_name: 'Aurora',
    state_code: 'SP',
    status: 'active',
    contact_name: 'Marina Costa',
    contact_email: 'marina@aurora.sp.gov.br',
    subscription_status: 'active',
    plan_name: 'Municipal Profissional',
    active_users: 12,
    last_activity_at: now,
    contract_reference: null,
    session_policy: 'block',
    session_timeout_minutes: 720,
    offline_tolerance_minutes: 60,
    created_at: '2025-03-01T12:00:00.000Z',
    updated_at: now,
    last_access_at: now,
  },
  subscription: {
    id: 'subscription-1',
    plan_id: 'plan-1',
    plan_name: 'Municipal Profissional',
    status: 'active',
    starts_at: '2025-03-01T12:00:00.000Z',
    trial_ends_at: null,
    current_period_start: '2026-07-01T12:00:00.000Z',
    current_period_end: '2026-08-03T12:00:00.000Z',
    grace_ends_at: null,
    canceled_at: null,
    overrides: {},
  },
  usage: [{
    resource_code: 'users',
    consumed: 68,
    hard_limit: 100,
    warning_percent: 80,
    period_start: '2026-07-01T12:00:00.000Z',
    period_end: '2026-08-01T12:00:00.000Z',
  }],
  users: [{
    id: 'member-1',
    user_id: 'user-1',
    name: 'Marina Costa',
    email: 'marina@aurora.sp.gov.br',
    role: 'coordinator',
    status: 'active',
    joined_at: '2025-03-01T12:00:00.000Z',
    last_login: now,
  }],
  sessions: [{
    id: 'session-1',
    user_id: 'user-1',
    device_name: 'Chrome · Windows',
    platform: 'web',
    status: 'active',
    last_heartbeat_at: now,
    started_at: now,
    ended_at: null,
    end_reason: null,
  }],
  inspections: [{
    id: 'inspection-1',
    protocol: 'TCS-2026-001',
    risk: 'R2',
    status: 'completed',
    occurred_at: now,
    agent_name: 'Marina Costa',
    address: 'Centro, Aurora',
  }],
  tickets: [{
    id: 'ticket-1',
    public_code: '#284',
    subject: 'Dúvida operacional',
    priority: 'normal',
    status: 'open',
    assigned_to: null,
    response_due_at: new Date(Date.now() + 86_400_000).toISOString(),
    resolution_due_at: null,
    escalate_at: null,
    created_at: now,
  }],
  onboarding: {
    pilot_started_at: '2025-03-01T12:00:00.000Z',
    coordinator_trained_at: '2025-03-10T12:00:00.000Z',
    checklist: {},
    review_due_at: '2026-08-01T12:00:00.000Z',
    review_completed_at: null,
    updated_at: now,
  },
  audit: [],
  can_view_sensitive: true,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('@/hooks/useCustomerDetail', () => ({
  useCustomerDetail: () => ({
    data: detail,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAdministrativeMutation', () => ({
  useAdministrativeMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const createAppointment = vi.fn().mockResolvedValue({});
vi.mock('@/hooks/useCustomerOperations', () => ({
  useCustomerOperations: () => ({
    data: {
      appointments: [],
      mapPoints: [],
      documents: [
        {
          id: 'inspection-1',
          inspection_id: 'inspection-1',
          protocol: 'TCS-2026-001',
          risk: 'r2',
          occurred_at: now,
          generated_at: now,
          storage_location: 'supabase',
          document_status: 'available',
          downloadable: true,
          can_generate: true,
        },
        {
          id: 'inspection-2',
          inspection_id: 'inspection-2',
          protocol: 'TCS-2026-002',
          risk: 'r3',
          occurred_at: now,
          generated_at: null,
          storage_location: 'supabase',
          document_status: 'pending_generation',
          downloadable: false,
          can_generate: true,
        },
      ],
      reports: [],
    },
    isLoading: false,
    error: null,
  }),
  useCreateCustomerAppointment: () => ({
    mutateAsync: createAppointment,
    isPending: false,
  }),
}));

vi.mock('@/components/customers/OrganizationFormDialog', () => ({
  OrganizationFormDialog: () => null,
}));

vi.mock('@/components/customers/ConvertIndividualToMunicipalDialog', () => ({
  ConvertIndividualToMunicipalDialog: () => null,
}));

vi.mock('@/components/customers/CustomerMap', () => ({
  CustomerMap: () => null,
}));

afterEach(cleanup);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function renderPage(path = '/app/clientes/organizacoes/aurora/resumo') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/clientes/organizacoes/:recordId/:section?" element={<CustomerDetailPage kind="organization" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Detalhe do cliente', () => {
  it('reproduz workspace, indicadores e atividade aprovados', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Prefeitura de Aurora' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Seções do cliente' })).toBeVisible();
    expect(screen.getAllByText('Municipal Profissional')[0]).toBeVisible();
    expect(screen.getByText('Vistorias recentes')).toBeVisible();
    expect(screen.getByText('Atividade recente')).toBeVisible();
    expect(screen.getByText('Contato principal')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = renderPage();
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('cria agendamento web pelo contrato compartilhado com o aplicativo', async () => {
    const user = userEvent.setup();
    renderPage('/app/clientes/organizacoes/aurora/agendamentos');

    await user.click(screen.getByRole('button', { name: 'Novo agendamento' }));
    await user.type(screen.getByLabelText('Título'), 'Vistoria preventiva');
    await user.type(screen.getByLabelText('Data e hora'), '2030-08-01T09:30');
    await user.type(screen.getByLabelText('Endereço'), 'Praça Central, 100');
    await user.click(screen.getByRole('button', { name: 'Criar agendamento' }));

    expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'organization:aurora',
      title: 'Vistoria preventiva',
      address: 'Praça Central, 100',
    }));
  }, 15_000);

  it('trata pessoas como membros da organização, sem criar um segundo painel de cliente', async () => {
    const user = userEvent.setup();
    renderPage('/app/clientes/organizacoes/aurora/equipe');

    expect(screen.getByRole('columnheader', { name: 'Membro' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Gerenciar membro' }));
    expect(screen.getByRole('heading', { name: 'Marina Costa' })).toBeVisible();
    expect(screen.getByText(/Equipe da organização/)).toBeVisible();
    expect(screen.getByText('Identidade e acesso')).toBeVisible();
  });

  it('mantém a ordem dos hooks do diálogo de assinatura estável', () => {
    // Regressão: o diálogo de edição usava `useState`/`useQuery`/`useEffect`
    // depois de um `return` antecipado.
    //
    // O guard é sobre a FONTE, e não sobre o comportamento em runtime: o
    // componente pai (`Subscription`) hoje desmonta o diálogo quando a
    // assinatura é nula, então o React nunca chega aBroken o erro — o defeito
    // está latente, a um refactor de distância de virar tela branca.
    //
    // A regra que detecta essa classe é `react-hooks/rules-of-hooks` do
    // ESLint, verificada pelo portão de lint (`npm run lint`, que roda no CI
    // do dashboard). Aqui a checagem é estrutural e barata: nenhum `return`
    // pode vir antes do primeiro hook dentro do componente do formulário.
    const fonte = readFileSync(
      resolve(process.cwd(), 'src/pages/CustomerDetailPage.tsx'),
      'utf8',
    );

    const corpoFormulario = fonte.slice(
      fonte.indexOf('function EditSubscriptionDialogForm('),
      fonte.indexOf('function EditSubscriptionDialogForm(') + 4000,
    );
    const primeiroHook = corpoFormulario.search(/\buse(State|Effect|Query|Mutation|Ref|Memo|Callback)\b/);
    const retornoAntecipado = corpoFormulario.search(/\breturn\b/);

    expect(primeiroHook).toBeGreaterThan(-1);
    // O `return` do tipo de retorno da função (`): ... {`) não conta; o que
    // interessa é um `return` de execução antes do primeiro hook.
    const retornoDeExecucao = /\{\r?\n\s*if\s*\([^)]*\)\s*return\b/.exec(corpoFormulario);
    expect(retornoDeExecucao === null || retornoDeExecucao.index > primeiroHook).toBe(true);
    expect(retornoAntecipado === -1 || retornoAntecipado > primeiroHook).toBe(true);
  });

  it('orienta a gerar no aplicativo quando o documento oficial estiver pendente', async () => {
    const user = userEvent.setup();
    renderPage('/app/clientes/organizacoes/aurora/laudos');

    expect(screen.getByText('1 disponível')).toBeVisible();
    expect(screen.getByText('1 pendente')).toBeVisible();
    expect(screen.getAllByText('Aguardando geração')[0]).toBeVisible();

    await user.click(screen.getAllByRole('button', { name: 'Gerar no aplicativo' })[0]);

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText('Documento oficial ainda não gerado')).toBeVisible();
    expect(screen.getByText(/gere primeiro o laudo pelo aplicativo/i)).toBeVisible();
    expect(screen.getByText('Protocolo TCS-2026-002')).toBeVisible();
  });
});
