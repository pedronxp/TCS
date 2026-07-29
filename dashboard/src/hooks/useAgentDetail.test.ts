import { describe, expect, it } from 'vitest';
import { agentKeys, parseAgentInspectionPage, parseAgentMap, parseAgentOperations, parseAgentSummary } from './useAgentDetail';

const agent = {
  user_id: '33333333-3333-4333-8333-333333333333', name: 'Agente Teste',
  role: 'agent', membership_status: 'active', effective_access: 'active',
  customer_name: 'Defesa Civil Teste',
};

describe('contrato do detalhe operacional do agente', () => {
  it('preserva customer e user nas chaves de cache', () => {
    expect(agentKeys.root('organization:a', 'user-a')).not.toEqual(agentKeys.root('organization:a', 'user-b'));
    expect(agentKeys.root('organization:a', 'user-a')).not.toEqual(agentKeys.root('organization:b', 'user-a'));
  });

  it('interpreta resumo sem inventar fonte técnica', () => {
    const result = parseAgentSummary({
      agent, period: { from: '2026-06-01T00:00:00Z', to: '2026-07-01T00:00:00Z', comparison_from: '2026-05-01T00:00:00Z', comparison_to: '2026-06-01T00:00:00Z' },
      metrics: { inspections: 61, previous_inspections: 12, active_days: 20, geolocated: 54, geolocated_percent: 88.5, document_complete: 40, document_complete_percent: 65.6, risk_distribution: { r1: 10, r2: 20, r3: 20, r4: 11 } },
      activity_by_day: [], last_session: null, last_technical_activity: null, can_view_sensitive: false,
    });
    expect(result.metrics.inspections).toBe(61);
    expect(result.lastTechnicalActivity).toBeNull();
    expect(result.canViewSensitive).toBe(false);
  });

  it('mantém total completo acima de 50 com cursor estável', () => {
    const items = Array.from({ length: 25 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      protocol: `T-${index}`, occurred_at: `2026-07-${String(25 - index).padStart(2, '0')}T12:00:00Z`,
      documents: { laudo: index % 2 === 0, relatorio: false, termo: false },
    }));
    const page = parseAgentInspectionPage({ items, total: 87, page_size: 25, next_cursor: { occurred_at: items[24].occurred_at, id: items[24].id }, can_view_sensitive: true });
    expect(page.items).toHaveLength(25);
    expect(page.total).toBe(87);
    expect(page.nextCursor?.id).toBe(items[24].id);
  });

  it('não expõe pontos nem downloads quando o suporte sensível expira', () => {
    const map = parseAgentMap({ points: [], filtered_total: 87, geolocated_total: 70, without_coordinates: 17, can_view_sensitive: false });
    const operations = parseAgentOperations({ appointments: [], documents: [{ document_id: 'x:laudo', inspection_id: 'x', kind: 'laudo', downloadable: false }], sessions: [], technical_activity: [], can_view_sensitive: false });
    expect(map.points).toEqual([]);
    expect(map.geolocatedTotal).toBe(70);
    expect(operations.documents[0].downloadable).toBe(false);
  });
});
