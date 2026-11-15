jest.mock('../../utils/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../../utils/uuid', () => ({ generateUUID: () => 'test' }));
import { supabase } from '../../utils/supabase';
import { checkInviteMunicipality } from '../OwnerAdministrationService';

function mockTables(organizations: unknown[], subscriptions: unknown[], error: unknown = null) {
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    const result = { data: table === 'organizations' ? organizations : subscriptions, error };
    const chain: any = { select: jest.fn(() => chain), eq: jest.fn(() => chain), in: jest.fn(() => chain), order: jest.fn(async () => result), limit: jest.fn(async () => result) };
    return chain;
  });
}
afterEach(() => jest.clearAllMocks());
it('impede confirmar município sem organização habilitada', async () => {
  mockTables([], []);
  await expect(checkInviteMunicipality('Belo Horizonte', 'MG')).rejects.toThrow('municipal_organization_not_found');
  expect(supabase.from).toHaveBeenCalledTimes(1);
});
it('impede confirmar organização sem assinatura ativa', async () => {
  mockTables([{ id: 'org', municipality_name: 'São Paulo' }], []);
  await expect(checkInviteMunicipality('São Paulo', 'SP')).rejects.toThrow('municipal_subscription_inactive');
});
it('permite continuar com organização e assinatura habilitadas', async () => {
  mockTables([{ id: 'org', municipality_name: ' Belo Horizonte ' }], [{ id: 'sub' }]);
  await expect(checkInviteMunicipality('Belo Horizonte', 'MG')).resolves.toBeUndefined();
});
it('diferencia falha de consulta de organização ausente', async () => {
  mockTables([], [], { message: 'network' });
  await expect(checkInviteMunicipality('Belo Horizonte', 'MG')).rejects.toThrow('Confira sua conexão');
});
