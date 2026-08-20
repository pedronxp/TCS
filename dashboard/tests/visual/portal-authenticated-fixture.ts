import type { Page, Route } from '@playwright/test';

export type PortalFixtureKind = 'individual' | 'organization';

export type PortalFixtureOptions = {
  accessOverrides?: Record<string, unknown>;
  accessUnavailable?: boolean;
  emptyDashboard?: boolean;
  emptyInspection?: boolean;
  emptySessions?: boolean;
  emptyWorkspaceSections?: string[];
  pendingRpcs?: string[];
  delayedRpcs?: string[];
  rpcDelayMs?: number;
  errorRpcs?: string[];
  checkoutStatus?: 'pending' | 'completed' | 'failed' | 'expired';
};

const fixedNow = '2026-07-29T15:00:00.000Z';
const userId = '61000000-0000-4000-8000-000000000001';
const organizationId = '62000000-0000-4000-8000-000000000001';

const user = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'ana.portal@tcs.local',
  email_confirmed_at: fixedNow,
  phone: '',
  confirmed_at: fixedNow,
  last_sign_in_at: fixedNow,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { name: 'Ana Cliente' },
  identities: [],
  created_at: fixedNow,
  updated_at: fixedNow,
  is_anonymous: false,
};

function accessToken() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    aud: 'authenticated',
    exp: 4_102_444_800,
    iat: 1_753_804_800,
    role: 'authenticated',
    sub: userId,
  })}.portal-visual-fixture`;
}

function session() {
  return {
    access_token: accessToken(),
    refresh_token: 'portal-visual-regression-refresh-token',
    expires_in: 2_349_000_000,
    expires_at: 4_102_444_800,
    token_type: 'bearer',
    user,
  };
}

function accessContext(kind: PortalFixtureKind) {
  const organization = kind === 'organization';
  return {
    account_kind: kind,
    user_id: userId,
    display_name: organization ? 'Marina Coordenadora' : 'Ana Cliente',
    organization_id: organization ? organizationId : null,
    organization_name: organization ? 'Prefeitura de Aurora' : null,
    role: organization ? 'admin' : null,
    membership_status: organization ? 'active' : null,
    subscription_status: 'active',
    cancel_at_period_end: false,
    plan_id: organization ? 'municipal-profissional' : 'individual-profissional',
    plan_version_id: organization
      ? '62000000-0000-4000-8000-000000000020'
      : '61000000-0000-4000-8000-000000000020',
    plan_name: organization ? 'Municipal Profissional' : 'Individual Profissional',
    features: { reports: true, municipal_portal: organization },
    limits: { inspections: organization ? 1500 : 150, users: organization ? 30 : 1 },
    usage: { inspections: organization ? 428 : 37, users: organization ? 12 : 1 },
    permissions: organization
      ? [
          'dashboard.read', 'inspection.read', 'inspection.create', 'map.read',
          'appointment.read', 'document.read', 'report.read', 'team.read',
          'team.manage', 'invite.agent', 'invite.manage', 'usage.read',
          'billing.read', 'billing.manage', 'support.read', 'support.create',
          'settings.read', 'settings.manage', 'profile.read', 'profile.manage',
        ]
      : [
          'dashboard.read', 'inspection.read', 'inspection.create', 'map.read',
          'appointment.read', 'document.read', 'report.read', 'usage.read',
          'billing.read', 'billing.manage', 'support.read', 'support.create',
          'profile.read', 'profile.manage',
        ],
    creation_allowed: true,
    restriction_cause: null,
  };
}

const inspections = [
  {
    id: '63000000-0000-4000-8000-000000000001',
    title: 'TCS-2026-041',
    protocol: 'TCS-2026-041',
    subtitle: 'Praça Central, 100',
    status: 'concluida',
    latitude: -1.4558,
    longitude: -48.5044,
  },
  {
    id: '63000000-0000-4000-8000-000000000002',
    title: 'TCS-2026-038',
    protocol: 'TCS-2026-038',
    subtitle: 'Rua das Mangueiras, 42',
    status: 'em_andamento',
    latitude: -1.462,
    longitude: -48.49,
  },
];

function workspace(section: string) {
  const workspaces: Record<string, { items: Array<Record<string, unknown>>; summary: Record<string, unknown> }> = {
    vistorias: {
      items: inspections,
      summary: { inspections: 37, generated_at: fixedNow },
    },
    mapa: { items: inspections, summary: {} },
    agenda: {
      items: [
        {
          id: 'agenda-1',
          title: 'Vistoria preventiva no Centro',
          status: 'pendente',
          scheduled_at: '2026-08-03T13:30:00.000Z',
          inspection_id: inspections[0].id,
        },
        {
          id: 'agenda-2',
          title: 'Retorno de acompanhamento',
          status: 'confirmado',
          scheduled_at: '2026-08-08T16:00:00.000Z',
          inspection_id: inspections[1].id,
        },
      ],
      summary: {},
    },
    documentos: {
      items: inspections.map((inspection) => ({
        ...inspection,
        title: `Laudo ${inspection.protocol}`,
        subtitle: 'PDF disponível com acesso temporário',
      })),
      summary: { inspections: 2, generated_at: fixedNow },
    },
    relatorios: {
      items: [
        { id: 'report-1', title: 'Distribuição por risco', subtitle: 'Período atual', status: 'atualizado' },
        { id: 'report-2', title: 'Produtividade operacional', subtitle: 'Últimos 30 dias', status: 'atualizado' },
      ],
      summary: { inspections: 37, generated_at: fixedNow },
    },
    consumo: {
      items: [
        { id: 'usage-1', title: 'Vistorias', subtitle: '37 de 150 utilizadas', status: '25%' },
        { id: 'usage-2', title: 'Armazenamento', subtitle: '1,8 GB de 10 GB', status: '18%' },
      ],
      summary: { inspections: 37 },
    },
    equipe: {
      items: [
        { id: 'member-1', user_id: userId, title: 'Marina Coordenadora', subtitle: 'admin', status: 'active' },
        { id: 'member-2', user_id: '61000000-0000-4000-8000-000000000002', title: 'Carlos Supervisor', subtitle: 'supervisor', status: 'active' },
        { id: 'member-3', user_id: '61000000-0000-4000-8000-000000000003', title: 'Joana Agente', subtitle: 'agent', status: 'active' },
      ],
      summary: {},
    },
    convites: {
      items: [
        { id: 'invite-1', title: 'novo.agente@aurora.sp.gov.br', subtitle: 'Agente · expira em 72 horas', status: 'pending' },
        { id: 'invite-2', title: 'supervisao@aurora.sp.gov.br', subtitle: 'Supervisor', status: 'accepted' },
      ],
      summary: {},
    },
    configuracoes: {
      items: [{
        id: organizationId,
        title: 'Prefeitura de Aurora',
        display_name: 'Prefeitura de Aurora',
        contact_name: 'Marina Costa',
        contact_email: 'marina@aurora.sp.gov.br',
        session_timeout_minutes: 480,
      }],
      summary: {},
    },
  };
  return { section, ...(workspaces[section] ?? { items: [], summary: {} }) };
}

function dashboard() {
  return {
    metrics: [
      { key: 'inspections', label: 'Vistorias no período', value: 37, detail: '12 concluídas nesta semana' },
      { key: 'appointments', label: 'Próximos agendamentos', value: 4 },
      { key: 'documents', label: 'Documentos disponíveis', value: 29 },
      { key: 'usage', label: 'Uso do plano', value: 25, detail: '25% do limite mensal' },
    ],
    upcoming: [
      { id: 'agenda-1', title: 'Vistoria preventiva no Centro', scheduledAt: '2026-08-03T13:30:00.000Z', status: 'pendente' },
      { id: 'agenda-2', title: 'Retorno de acompanhamento', scheduledAt: '2026-08-08T16:00:00.000Z', status: 'confirmado' },
    ],
    recent_inspections: inspections.map((inspection, index) => ({
      id: inspection.id,
      protocol: inspection.protocol,
      status: inspection.status,
      risk_level: index === 0 ? 'R3' : 'R2',
      occurred_at: index === 0 ? fixedNow : '2026-07-25T13:00:00.000Z',
    })),
  };
}

function rpcResponse(
  name: string,
  body: Record<string, unknown>,
  kind: PortalFixtureKind,
  options: PortalFixtureOptions,
) {
  switch (name) {
    case 'get_portal_access_context':
      return options.accessUnavailable
        ? null
        : { ...accessContext(kind), ...options.accessOverrides };
    case 'portal_get_dashboard':
      return options.emptyDashboard
        ? { metrics: [], upcoming: [], recent_inspections: [] }
        : dashboard();
    case 'portal_get_workspace':
      return options.emptyWorkspaceSections?.includes(String(body.p_section ?? ''))
        ? { section: String(body.p_section ?? ''), items: [], summary: {} }
        : workspace(String(body.p_section ?? ''));
    case 'portal_get_inspection':
      if (options.emptyInspection) return null;
      return {
        id: inspections[0].id,
        protocol: 'TCS-2026-041',
        status: 'concluida',
        risk_level: 'R3',
        score: 72,
        occurred_at: fixedNow,
        address: 'Praça Central, 100',
        municipality: 'Aurora',
        agent_name: 'Joana Agente',
        latitude: -1.4558,
        longitude: -48.5044,
        document_available: true,
      };
    case 'portal_list_own_sessions':
      if (options.emptySessions) return [];
      return [{
        id: '64000000-0000-4000-8000-000000000001',
        device_name: 'Navegador principal',
        platform: 'web',
        status: 'active',
        started_at: fixedNow,
        last_heartbeat_at: fixedNow,
      }];
    case 'portal_get_invite_preview':
      return {
        organization_name: 'Prefeitura de Aurora',
        email_hint: 'a***@aurora.sp.gov.br',
        role: 'agent',
        expires_at: '2026-08-01T15:00:00.000Z',
        status: 'pending',
      };
    case 'portal_get_checkout_status':
      return { status: options.checkoutStatus ?? 'completed' };
    case 'portal_create_organization_invite':
      return { allowed: true, delivery_token: 'a'.repeat(48) };
    default:
      return true;
  }
}

async function fulfillApi(
  page: Page,
  route: Route,
  kind: PortalFixtureKind,
  options: PortalFixtureOptions,
) {
  const request = route.request();
  const url = new URL(request.url());
  const rpcMatch = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/);
  let body: unknown = [];

  if (url.pathname === '/auth/v1/user') body = user;
  else if (url.pathname.startsWith('/auth/v1/token')) body = session();
  else if (rpcMatch) {
    if (options.pendingRpcs?.includes(rpcMatch[1])) {
      await new Promise<void>((resolve) => {
        if (page.isClosed()) resolve();
        else page.once('close', resolve);
      });
      return;
    }
    if (options.delayedRpcs?.includes(rpcMatch[1])) {
      await new Promise((resolve) => setTimeout(resolve, options.rpcDelayMs ?? 5_000));
    }
    if (options.errorRpcs?.includes(rpcMatch[1])) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ message: 'visual_fixture_error' }),
      });
      return;
    }
    const requestBody = request.postDataJSON() as Record<string, unknown> | null;
    body = rpcResponse(rpcMatch[1], requestBody ?? {}, kind, options);
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'content-range': '0-0/0',
    },
    body: request.method() === 'HEAD' ? '' : JSON.stringify(body),
  });
}

export async function installPortalFixture(
  page: Page,
  kind: PortalFixtureKind,
  authenticated = true,
  options: PortalFixtureOptions = {},
) {
  if (authenticated) {
    await page.addInitScript((storedSession) => {
      window.localStorage.setItem('tcs-dashboard-auth', JSON.stringify(storedSession));
      window.localStorage.setItem('tcs-portal-device-id', 'portal-visual-device');
    }, session());
  }
  await page.route('**/auth/v1/**', (route) => fulfillApi(page, route, kind, options));
  await page.route('**/rest/v1/**', (route) => fulfillApi(page, route, kind, options));
}
