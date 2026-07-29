jest.mock('../../utils/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

import { ensureInspectionLaudo } from '../LaudoService';

describe('LaudoService', () => {
  let mockInvoke: jest.Mock;

  beforeEach(() => {
    mockInvoke = jest.requireMock('../../utils/supabase').supabase.functions.invoke as jest.Mock;
    mockInvoke.mockReset();
  });

  it('solicita a geração idempotente da vistoria concluída', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        reused: false,
        document_status: 'available',
        signed_url: 'https://signed.example/laudo.pdf',
        expires_in: 60,
      },
      error: null,
    });

    await expect(ensureInspectionLaudo('inspection-1')).resolves.toMatchObject({
      document_status: 'available',
    });
    expect(mockInvoke).toHaveBeenCalledWith('generate-inspection-laudo', {
      body: {
        inspection_id: 'inspection-1',
        customer_id: undefined,
        force: false,
      },
    });
  });

  it('não trata falha de geração como laudo disponível', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, error: 'inspection_not_available' },
      error: null,
    });

    await expect(ensureInspectionLaudo('inspection-2')).rejects.toThrow('inspection_not_available');
  });
});
