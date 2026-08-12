import { protocolDisplay } from '../protocoloDisplay';

describe('protocolDisplay', () => {
  it('does not turn a missing persisted protocol into a local official number', () => {
    expect(protocolDisplay(null)).toEqual({
      value: 'Protocolo pendente de sincronização',
      isOfficial: false,
    });
  });

  it('keeps the server persisted protocol unchanged', () => {
    expect(protocolDisplay('PREF-CPS-2026-00001')).toEqual({
      value: 'PREF-CPS-2026-00001',
      isOfficial: true,
    });
  });
});
