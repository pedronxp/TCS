jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn() } }));
import { supabase } from '../supabase';
import { checkRateLimit } from '../rateLimitUtils';

describe('operational rate-limit availability', () => {
  beforeEach(() => jest.clearAllMocks());
  it('accepts only explicit server approval while online', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });
    await expect(checkRateLimit('gerar_pdf')).resolves.toEqual({ allowed: true });
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: false, error: null });
    await expect(checkRateLimit('gerar_pdf')).resolves.toMatchObject({ allowed: false, reason: 'limit' });
  });
  it('does not turn denied access or a failed RPC into unlimited permission', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(checkRateLimit('criar_vistoria')).resolves.toMatchObject({ allowed: false, reason: 'unavailable' });
    (supabase.rpc as jest.Mock).mockRejectedValue(new Error('fetch failed'));
    await expect(checkRateLimit('gerar_pdf')).resolves.toMatchObject({ allowed: false, reason: 'unavailable' });
  });
  it('preserves explicit offline collection without reporting a server verification', async () => {
    await expect(checkRateLimit('criar_vistoria', { offline: true })).resolves.toEqual({ allowed: true, reason: 'deferred' });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
