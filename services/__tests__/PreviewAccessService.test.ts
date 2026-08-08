jest.mock('../../utils/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

import { supabase } from '../../utils/supabase';
import { claimPublicPreviewAttempt, getPublicPreviewAccess } from '../PreviewAccessService';

const invoke = supabase.functions.invoke as jest.Mock;

describe('PreviewAccessService', () => {
  beforeEach(() => invoke.mockReset());

  it('consulta o saldo sem consumir tentativa', async () => {
    invoke.mockResolvedValue({ data: { allowed: true, used: 1, limit: 2, remaining: 1 }, error: null });
    await expect(getPublicPreviewAccess('device-1234567890')).resolves.toMatchObject({ remaining: 1 });
    expect(invoke).toHaveBeenCalledWith('public-preview-access', {
      body: { action: 'status', device_id: 'device-1234567890' },
    });
  });

  it('consome uma tentativa antes de iniciar a vistoria', async () => {
    invoke.mockResolvedValue({ data: { allowed: false, used: 2, limit: 2, remaining: 0 }, error: null });
    await expect(claimPublicPreviewAttempt('device-1234567890')).resolves.toMatchObject({ allowed: false });
  });
});
