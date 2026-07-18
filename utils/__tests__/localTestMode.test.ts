import {
  isDeveloperSession,
  isDeveloperUser,
  isLocalTestSession,
  isLocalTestUser,
} from '../localTestMode';

jest.mock('../supabase', () => ({ supabase: {} }));

describe('localTestMode', () => {
  it('aceita somente a marca protegida em app_metadata', () => {
    expect(isLocalTestUser({ app_metadata: { local_test_mode: true } } as any)).toBe(true);
    expect(isLocalTestUser({ app_metadata: { local_test_mode: false } } as any)).toBe(false);
    expect(isLocalTestUser({ app_metadata: {} } as any)).toBe(false);
  });

  it('não confia em user_metadata para ativar o modo local', () => {
    expect(isLocalTestUser({
      app_metadata: {},
      user_metadata: { local_test_mode: true },
    } as any)).toBe(false);
  });

  it('reconhece a sessão marcada como teste local', () => {
    expect(isLocalTestSession({
      user: { app_metadata: { local_test_mode: true } },
    } as any)).toBe(true);
  });

  it('reconhece Desenvolvedor somente pelas duas marcas protegidas', () => {
    expect(isDeveloperUser({
      app_metadata: { developer_access: true, account_type: 'developer_demo' },
    } as any)).toBe(true);
    expect(isDeveloperUser({
      app_metadata: { developer_access: true, account_type: 'outro' },
    } as any)).toBe(false);
    expect(isDeveloperSession({
      user: { app_metadata: { developer_access: true, account_type: 'developer_demo' } },
    } as any)).toBe(true);
  });
});
