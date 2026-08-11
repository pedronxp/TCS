// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentDetailPage } from './AgentDetailPage';

const mocks = vi.hoisted(() => ({
  summaryHook: vi.fn(),
  inspectionsHook: vi.fn(),
  mapHook: vi.fn(),
  operationsHook: vi.fn(),
  invoke: vi.fn(),
  can: vi.fn(() => true),
}));

const summaryData = {
  agent: {
    userId: 'agent-7',
    name: 'Marina Alves',
    email: null,
    phone: null,
    role: 'agent',
    membershipStatus: 'active',
    effectiveAccess: 'active',
    joinedAt: '2026-01-01T12:00:00Z',
    lastLogin: '2026-07-25T12:00:00Z',
    customerName: 'Defesa Civil Aurora',
    planName: 'Municipal',
  },
  period: {
    from: '2026-06-25T00:00:00Z',
    to: '2026-07-26T00:00:00Z',
    comparisonFrom: '2026-05-25T00:00:00Z',
    comparisonTo: '2026-06-25T00:00:00Z',
  },
  metrics: {
    inspections: 61,
    previousInspections: 50,
    activeDays: 18,
    lastInspectionAt: '2026-07-25T12:00:00Z',
    geolocated: 54,
    geolocatedPercent: 88.5,
    documentComplete: 40,
    documentCompletePercent: 65.6,
    risks: { r1: 10, r2: 20, r3: 20, r4: 11 },
  },
  activityByDay: [{ day: '2026-07-25', total: 4 }],
  lastSession: null,
  lastTechnicalActivity: null,
  canViewSensitive: false,
};

const operationsData = {
  appointments: [],
  documents: [],
  sessions: [],
  technicalActivity: [],
  canViewSensitive: false,
};

vi.mock('@/hooks/useAgentDetail', () => ({
  agentKeys: { root: (customerId: string, userId: string) => ['internal-agent', customerId, userId] },
  useAgentSummary: (...args: unknown[]) => mocks.summaryHook(...args),
  useAgentInspections: (...args: unknown[]) => mocks.inspectionsHook(...args),
  useAgentMap: (...args: unknown[]) => mocks.mapHook(...args),
  useAgentOperations: (...args: unknown[]) => mocks.operationsHook(...args),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: mocks.can }),
}));

vi.mock('@/hooks/useAdministrativeMutation', () => ({
  useAdministrativeMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    rpc: vi.fn(),
  },
}));

vi.mock('@/components/customers/CustomerMap', () => ({
  CustomerMap: () => <div aria-label="Mapa de vistorias">Mapa</div>,
}));

function query(data: unknown) {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn() };
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/clientes/:customerId/usuarios/:userId/:userSection?" element={<AgentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.summaryHook.mockReturnValue(query(summaryData));
  mocks.inspectionsHook.mockReturnValue(query({ items: [], total: 0, pageSize: 25, nextCursor: null, canViewSensitive: false }));
  mocks.mapHook.mockReturnValue(query({ points: [], filteredTotal: 0, geolocatedTotal: 0, withoutCoordinates: 0, canViewSensitive: false }));
  mocks.operationsHook.mockReturnValue(query(operationsData));
  mocks.can.mockReturnValue(true);
});

mocks.summaryHook.mockReturnValue(query(summaryData));
mocks.inspectionsHook.mockReturnValue(query({ items: [], total: 0, pageSize: 25, nextCursor: null, canViewSensitive: false }));
mocks.mapHook.mockReturnValue(query({ points: [], filteredTotal: 0, geolocatedTotal: 0, withoutCoordinates: 0, canViewSensitive: false }));
mocks.operationsHook.mockReturnValue(query(operationsData));

describe('detalhe operacional do agente', () => {
  it('preserva o escopo do cliente, filtros compartilhados e proteção de dados sensíveis', async () => {
    const { container } = renderRoute('/app/clientes/organization%3Aaurora/usuarios/agent-7/resumo?period=7&risk=r3');

    expect(screen.getByRole('heading', { level: 1, name: 'Marina Alves' })).toBeVisible();
    expect(screen.getByRole('complementary', { name: 'Contexto persistente do cliente' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Abrir resumo de Defesa Civil Aurora' })).toHaveAttribute('href', '/app/clientes/organization%3Aaurora/resumo');
    expect(screen.getByText('Dados sensíveis protegidos')).toBeVisible();
    expect(mocks.summaryHook).toHaveBeenCalledWith(
      'organization:aurora',
      'agent-7',
      expect.objectContaining({ risk: 'r3' }),
    );
    expect(screen.getByRole('link', { name: 'Mapa' })).toHaveAttribute('href', expect.stringContaining('period=7'));
    expect(screen.getByRole('link', { name: 'Mapa' })).toHaveAttribute('href', expect.stringContaining('risk=r3'));

    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('oferece alternativa textual equivalente ao mapa autorizado', () => {
    mocks.summaryHook.mockReturnValue(query({ ...summaryData, canViewSensitive: true }));
    mocks.mapHook.mockReturnValue(query({
      points: [{ id: 'cluster-1', latitude: -1.4558, longitude: -48.5044, count: 3, occurredAt: '2026-07-25T12:00:00Z', risks: { r1: 0, r2: 1, r3: 2, r4: 0 } }],
      filteredTotal: 4,
      geolocatedTotal: 3,
      withoutCoordinates: 1,
      canViewSensitive: true,
    }));

    renderRoute('/app/clientes/organization%3Aaurora/usuarios/agent-7/mapa');

    expect(screen.getByLabelText('Mapa de vistorias')).toBeVisible();
    expect(screen.getByText('Alternativa textual ao mapa')).toBeVisible();
    expect(screen.getByText(/3 vistoria\(s\) · risco predominante r3/i)).toBeVisible();
    expect(screen.getByText('-1.4558, -48.5044')).toBeVisible();
  });

  it('solicita link assinado de curta duração com cliente, agente e documento corretos', async () => {
    const user = userEvent.setup();
    mocks.summaryHook.mockReturnValue(query({ ...summaryData, canViewSensitive: true }));
    mocks.operationsHook.mockReturnValue(query({
      ...operationsData,
      canViewSensitive: true,
      documents: [{
        documentId: 'inspection-1:laudo',
        inspectionId: 'inspection-1',
        kind: 'laudo',
        protocol: 'AUR-001',
        generatedAt: '2026-07-25T12:00:00Z',
        storageLocation: 'laudos',
        downloadable: true,
      }],
    }));
    mocks.invoke.mockResolvedValue({ data: { ok: true, signed_url: 'https://signed.example/documento', expires_in: 60, disposition: 'view' }, error: null });

    renderRoute('/app/clientes/organization%3Aaurora/usuarios/agent-7/documentos');
    await user.click(screen.getByRole('button', { name: 'Autorizar por 60s' }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('internal-agent-document', {
      body: {
        customer_id: 'organization:aurora',
        user_id: 'agent-7',
        inspection_id: 'inspection-1',
        kind: 'laudo',
        mode: 'view',
      },
    }));
    expect(await screen.findByRole('link', { name: 'Abrir link autorizado' })).toHaveAttribute('href', 'https://signed.example/documento');
    expect(screen.getByRole('link', { name: 'Abrir link autorizado' })).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
