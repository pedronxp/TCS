import { fetchInspectionQuality, canReviewInspectionQuality } from '../InspectionQualityService';

describe('inspection quality status', () => {
  it('does not turn a server failure into an endless loading status', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'offline' } });
    await expect(fetchInspectionQuality({ rpc } as any, 'inspection')).rejects.toThrow('offline');
  });
  it('empty response is unknown, never an assumed pending queue', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
    await expect(fetchInspectionQuality({ rpc } as any, 'inspection')).resolves.toBeNull();
  });
  it('returns an approved cycle and requests the specific inspection', async () => {
    const row = { status: 'aprovada', ciclo: 2, nota: 9, parecer: 'Conferida' };
    const rpc = jest.fn().mockResolvedValue({ data: [row], error: null });
    await expect(fetchInspectionQuality({ rpc } as any, 'inspection')).resolves.toEqual(row);
    expect(rpc).toHaveBeenCalledWith('qe_status_vistoria', { p_vistoria_id: 'inspection' });
  });
  it('rejects unexpected statuses rather than claiming a correction is needed', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [{ status: 'invalid' }], error: null });
    await expect(fetchInspectionQuality({ rpc } as any, 'inspection')).rejects.toThrow();
  });
  it('lets owner find review without granting other internal staff access', () => {
    for (const role of ['owner', 'supervisor', 'admin', 'master_admin']) expect(canReviewInspectionQuality(role)).toBe(true);
    for (const role of ['agent', 'support', 'developer', undefined]) expect(canReviewInspectionQuality(role)).toBe(false);
  });
});
