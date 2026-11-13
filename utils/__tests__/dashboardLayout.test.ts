import { buscarLayoutDashboard, DEFAULT_LAYOUTS } from '../dashboardLayout';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn() } }));

describe('buscarLayoutDashboard', () => {
  it.each([{ data: [] }, { data: null }, { data: [{ widget: 'antigo', visivel: true }] }])(
    'usa o padrão quando o servidor não retorna um template utilizável: %j',
    async ({ data }) => {
      jest.mocked(supabase.rpc).mockResolvedValueOnce({ data, error: null } as never);
      await expect(buscarLayoutDashboard('agent')).resolves.toEqual(DEFAULT_LAYOUTS.agent);
    },
  );

  it('preserva a configuração de um widget explicitamente oculto', async () => {
    jest.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ widget: 'acao_principal', visivel: false, ordem: 1 }], error: null,
    } as never);
    const layout = await buscarLayoutDashboard('agent');
    expect(layout.every(item => !item.visivel)).toBe(true);
  });
});
