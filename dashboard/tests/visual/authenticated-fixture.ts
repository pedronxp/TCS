import type { Page, Route } from '@playwright/test';

export type InternalRole = 'owner' | 'developer';

const apiOrigin = 'https://visual-regression.invalid';
const fixedNow = '2026-07-28T15:00:00.000Z';
const userId = '00000000-0000-4000-8000-000000000001';

const permissions = [
  'console.read',
  'dashboard.executive.read',
  'dashboard.technical.read',
  'customer.read',
  'customer.sensitive.read',
  'customer.sensitive.request',
  'customer.write',
  'commercial.read',
  'commercial.write',
  'support.read',
  'support.write',
  'session.read',
  'session.terminate',
  'staff.read',
  'staff.manage',
  'audit.read',
  'technical.read',
  'technical.write',
  'build.request',
  'build.approve',
  'configuration.prepare',
  'configuration.publish',
] as const;

const user = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'visual@tcs.local',
  email_confirmed_at: fixedNow,
  phone: '',
  confirmed_at: fixedNow,
  last_sign_in_at: fixedNow,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
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
    iat: 1_753_718_400,
    role: 'authenticated',
    sub: userId,
  })}.visual-fixture`;
}

function session() {
  return {
    access_token: accessToken(),
    refresh_token: 'visual-regression-refresh-token',
    expires_in: 2_349_000_000,
    expires_at: 4_102_444_800,
    token_type: 'bearer',
    user,
  };
}

function profile(role: InternalRole) {
  return {
    id: `visual-${role}`,
    user_id: userId,
    display_name: role === 'owner' ? 'Patrícia Owner' : 'Daniel Developer',
    role,
    status: 'active',
    permissions,
    assurance_level: 'aal2',
  };
}

function dashboard(role: InternalRole) {
  if (role === 'developer') {
    return {
      kind: 'technical',
      metrics: [
        { key: 'builds_running', label: 'Builds em execução', value: 1 },
        { key: 'builds_failed', label: 'Builds com falha', value: 0 },
        { key: 'sync', label: 'Alertas de sincronização', value: 2 },
        { key: 'storage', label: 'Alertas de armazenamento', value: 0 },
        { key: 'errors', label: 'Erros críticos', value: 0 },
      ],
      attention: [],
      release: {
        published_version: '2.17.0',
        minimum_version: '2.15.0',
        development_version: '2.18.0-rc.3',
      },
    };
  }
  return {
    kind: 'executive',
    metrics: [
      { key: 'customers', label: 'Clientes cadastrados', value: 148 },
      { key: 'subscriptions', label: 'Assinaturas vigentes', value: 143 },
      { key: 'renewals', label: 'Renovações em 30 dias', value: 8 },
      { key: 'past_due', label: 'Assinaturas em risco', value: 3 },
      { key: 'support', label: 'Chamados abertos', value: 12 },
      { key: 'sla', label: 'SLA vencido', value: 1 },
      { key: 'onboarding', label: 'Onboardings ativos', value: 4 },
    ],
    attention: [],
    release: null,
  };
}

const customerDetail = {
  customer: {
    customer_id: 'organization:aurora',
    kind: 'organization',
    subject_id: 'organization-aurora',
    display_name: 'Prefeitura de Aurora',
    legal_name: 'Município de Aurora',
    municipality_name: 'Aurora',
    state_code: 'SP',
    status: 'active',
    contact_name: 'Marina Costa',
    contact_email: 'marina@aurora.sp.gov.br',
    contract_reference: 'TCS-AURORA-2026',
    session_policy: 'block',
    session_timeout_minutes: 720,
    offline_tolerance_minutes: 60,
    created_at: '2025-03-01T12:00:00.000Z',
    updated_at: fixedNow,
    last_access_at: fixedNow,
  },
  subscription: null,
  usage: [],
  users: [{
    id: 'membership-agent-7',
    user_id: '00000000-0000-4000-8000-000000000007',
    name: 'Marina Alves',
    email: 'marina@aurora.sp.gov.br',
    role: 'agent',
    status: 'active',
    joined_at: '2026-01-01T12:00:00.000Z',
    last_login: fixedNow,
  }],
  sessions: [],
  inspections: [],
  tickets: [],
  onboarding: null,
  audit: [],
  can_view_sensitive: true,
};

const customerOperations = {
  appointments: [
    {
      id: 'appointment-web',
      title: 'Vistoria preventiva no Centro',
      status: 'pendente',
      scheduled_at: '2026-08-03T13:30:00.000Z',
      agent_name: 'Marina Alves',
      address: 'Praça Central, 100',
      latitude: -1.4558,
      longitude: -48.5044,
      origin: 'web',
    },
    {
      id: 'appointment-app',
      title: 'Retorno de acompanhamento',
      status: 'concluido',
      scheduled_at: '2026-07-22T16:00:00.000Z',
      agent_name: 'Marina Alves',
      address: 'Rua das Mangueiras, 42',
      latitude: -1.462,
      longitude: -48.49,
      origin: 'app',
    },
  ],
  map_points: [
    { id: 'map-1', protocol: 'TCS-2026-041', risk: 'r1', status: 'completed', occurred_at: fixedNow, latitude: -1.4558, longitude: -48.5044, address: 'Praça Central, 100' },
    { id: 'map-2', protocol: 'TCS-2026-038', risk: 'r3', status: 'completed', occurred_at: '2026-07-24T15:00:00.000Z', latitude: -1.462, longitude: -48.49, address: 'Rua das Mangueiras, 42' },
    { id: 'map-3', protocol: 'TCS-2026-030', risk: 'r4', status: 'completed', occurred_at: '2026-07-20T15:00:00.000Z', latitude: -1.443, longitude: -48.512, address: 'Avenida Norte, 18' },
  ],
  documents: [
    { id: 'inspection-1', inspection_id: 'inspection-1', protocol: 'TCS-2026-041', risk: 'r3', occurred_at: fixedNow, generated_at: fixedNow, storage_location: 'supabase', document_status: 'available', downloadable: true, can_generate: true },
    { id: 'inspection-2', inspection_id: 'inspection-2', protocol: 'TCS-2026-030', risk: 'r4', occurred_at: '2026-07-20T15:00:00.000Z', generated_at: '2026-07-20T15:00:00.000Z', storage_location: 'supabase', document_status: 'available', downloadable: true, can_generate: true },
    { id: 'inspection-3', inspection_id: 'inspection-3', protocol: 'TCS-2026-028', risk: 'r2', occurred_at: '2026-07-18T15:00:00.000Z', generated_at: null, storage_location: 'supabase', document_status: 'pending_generation', downloadable: false, can_generate: true },
  ],
  reports: [],
};

const agentSummary = {
  agent: {
    user_id: 'agent-7',
    name: 'Marina Alves',
    email: null,
    phone: null,
    role: 'agent',
    membership_status: 'active',
    effective_access: 'active',
    joined_at: '2026-01-01T12:00:00.000Z',
    last_login: fixedNow,
    customer_name: 'Prefeitura de Aurora',
    plan_name: 'Municipal',
  },
  period: {
    from: '2026-06-28T00:00:00.000Z',
    to: fixedNow,
    comparison_from: '2026-05-28T00:00:00.000Z',
    comparison_to: '2026-06-28T00:00:00.000Z',
  },
  metrics: {
    inspections: 61,
    previous_inspections: 50,
    active_days: 18,
    last_inspection_at: fixedNow,
    geolocated: 54,
    geolocated_percent: 88.5,
    document_complete: 40,
    document_complete_percent: 65.6,
    risk_distribution: { r1: 10, r2: 20, r3: 20, r4: 11 },
  },
  activity_by_day: [{ day: '2026-07-28', total: 4 }],
  last_session: null,
  last_technical_activity: null,
  can_view_sensitive: false,
};

function rpcResponse(name: string, role: InternalRole): unknown {
  switch (name) {
    case 'get_internal_staff_profile':
      return profile(role);
    case 'get_internal_dashboard':
      return dashboard(role);
    case 'list_internal_customers':
      return { items: [], total: 0, limit: 25, offset: 0 };
    case 'get_internal_customer_detail':
      return customerDetail;
    case 'get_internal_customer_operations':
      return customerOperations;
    case 'get_internal_agent_summary':
      return agentSummary;
    case 'list_internal_agent_inspections':
      return { items: [], total: 0, page_size: 25, next_cursor: null, can_view_sensitive: false };
    case 'get_internal_agent_map':
      return { points: [], filtered_total: 0, geolocated_total: 0, without_coordinates: 0, can_view_sensitive: false };
    case 'get_internal_agent_operations':
      return { appointments: [], documents: [], sessions: [], technical_activity: [], can_view_sensitive: false };
    case 'get_internal_session_workspace':
      return {
        items: [],
        total: 0,
        overview: { active_total: 0, platforms: { web: 0, android: 0, ios: 0 } },
      };
    case 'list_internal_archive_lifecycle':
      return { config: { mode: 'manual', enabled: false, days_threshold: 7 }, pending: [], history: [], restore_requests: [] };
    default:
      return [];
  }
}

async function fulfillApi(route: Route, role: InternalRole) {
  const request = route.request();
  const url = new URL(request.url());
  const rpcMatch = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/);
  let body: unknown = [];

  if (url.pathname === '/auth/v1/user') body = user;
  else if (url.pathname.startsWith('/auth/v1/token')) body = session();
  else if (rpcMatch) body = rpcResponse(rpcMatch[1], role);

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

export async function installAuthenticatedFixture(page: Page, role: InternalRole) {
  await page.addInitScript((storedSession) => {
    window.localStorage.setItem('tcs-dashboard-auth', JSON.stringify(storedSession));
  }, session());
  await page.route(`${apiOrigin}/**`, (route) => fulfillApi(route, role));
}
