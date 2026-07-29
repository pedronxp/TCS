import { describe, expect, it } from 'vitest';
import { parseCustomerOperations } from './useCustomerOperations';

describe('operações do cliente', () => {
  it('preserva a origem web do agendamento e a autorização do laudo', () => {
    const result = parseCustomerOperations({
      appointments: [{
        id: 'appointment-1',
        title: 'Vistoria preventiva',
        origin: 'web',
      }],
      map_points: [],
      documents: [{
        id: 'inspection-1',
        inspection_id: 'inspection-1',
        protocol: 'TCS-2026-001',
        storage_location: 'supabase',
        occurred_at: '2026-07-28T12:00:00.000Z',
        document_status: 'available',
        downloadable: true,
        can_generate: true,
      }],
      reports: [],
    });

    expect(result.appointments[0].origin).toBe('web');
    expect(result.documents[0]).toMatchObject({
      inspection_id: 'inspection-1',
      document_status: 'available',
      downloadable: true,
      can_generate: true,
    });
  });

  it('trata registros antigos como originados no aplicativo', () => {
    const result = parseCustomerOperations({
      appointments: [{ id: 'appointment-legacy' }],
      map_points: [],
      documents: [],
      reports: [],
    });

    expect(result.appointments[0].origin).toBe('app');
  });
});
