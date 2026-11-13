jest.mock('../../utils/supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '../../utils/supabase';
import { ownerMutation, ownerItems } from '../OwnerAdministrationService';
describe('owner mutations', () => {
  beforeEach(() => jest.clearAllMocks());
  it('refuses a mutation without an audit reason before transmitting', async () => {
    await expect(ownerMutation('set_account_lock_state', {}, 'curto')).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it('preserves the operation id across retries and treats a failed business result as failure', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: { ok: false, error: 'invalid_action' }, error: null });
    await expect(ownerMutation('test_rpc', {}, 'Motivo completo', 'same-operation')).rejects.toThrow('invalid_action');
    expect(supabase.rpc).toHaveBeenCalledWith('test_rpc', expect.objectContaining({ p_operation_id: 'same-operation' }));
  });
  it('does not invent records from malformed responses', () => {
    expect(ownerItems({ total: 10 })).toEqual([]);
    expect(ownerItems({ items: [null, false, { id: 'a' }] })).toEqual([{ id: 'a' }]);
  });
});
