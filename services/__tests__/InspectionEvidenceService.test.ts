import { canReadCachedInspection, loadInspectionEvidence } from '../InspectionEvidenceService';

function client(data: any, error: any = null) {
  const single = jest.fn().mockResolvedValue({ data, error });
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single };
  return { from: jest.fn(() => query) };
}
const local = { foto_url: 'file:///pending.jpg', fotos_urls: '["file:///second.jpg"]', sincronizado: 0 };
describe('inspection evidence on return to result', () => {
  it('does not expose an earlier owner session cache to another agent', () => {
    const record = { agente_uid: 'pedro', municipio: 'Cidade A' };
    expect(canReadCachedInspection({ uid: 'ana', role: 'agent', municipio: 'Cidade A' }, record)).toBe(false);
    expect(canReadCachedInspection({ uid: 'pedro', role: 'agent' }, record)).toBe(true);
    expect(canReadCachedInspection({ uid: 'owner', role: 'owner' }, record)).toBe(true);
    expect(canReadCachedInspection({ uid: 'admin', role: 'admin', municipio: 'Cidade B' }, record)).toBe(false);
    expect(canReadCachedInspection(null, record)).toBe(false);
  });
  it('preserves local pending captures before any remote stale list', async () => {
    const api = client({ fotoUrl: 'fotos:older.jpg' });
    await expect(loadInspectionEvidence(api as any, 'inspection', local)).resolves.toEqual({ primary: 'file:///pending.jpg', extras: ['file:///second.jpg'] });
    expect(api.from).not.toHaveBeenCalled();
  });
  it('reloads server photos for an owner whose phone has no inspection row', async () => {
    const api = client({ fotoUrl: 'fotos:new.jpg', fotosUrls: ['fotos:extra.jpg'] });
    await expect(loadInspectionEvidence(api as any, 'inspection', null)).resolves.toEqual({ primary: 'fotos:new.jpg', extras: ['fotos:extra.jpg'] });
  });
  it('does not overwrite new remote media with an older synchronized local cache', async () => {
    const api = client({ fotoUrl: 'fotos:new.jpg', fotosUrls: [] });
    await expect(loadInspectionEvidence(api as any, 'inspection', { ...local, sincronizado: 1 })).resolves.toEqual({ primary: 'fotos:new.jpg', extras: [] });
  });
  it('keeps existing cache available when offline; training never queries production', async () => {
    const api = client(null, new Error('offline'));
    await expect(loadInspectionEvidence(api as any, 'inspection', { ...local, sincronizado: 1 })).resolves.toEqual({ primary: local.foto_url, extras: ['file:///second.jpg'] });
    api.from.mockClear();
    await expect(loadInspectionEvidence(api as any, 'inspection', local, true)).resolves.toEqual({ primary: local.foto_url, extras: ['file:///second.jpg'] });
    expect(api.from).not.toHaveBeenCalled();
  });
});
