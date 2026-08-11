import { describe, expect, it } from 'vitest';
import { customerDetailPath, customerIdFromRoute, legacyCustomerDetailPath, legacyCustomerMemberPath } from './customerRoutes';

describe('rotas canônicas de clientes', () => {
  it('separa organização municipal de conta individual', () => {
    expect(customerDetailPath('organization:aurora')).toBe('/app/clientes/organizacoes/aurora');
    expect(customerDetailPath('organization:aurora', 'equipe')).toBe('/app/clientes/organizacoes/aurora/equipe');
    expect(customerDetailPath('user:ana-silva')).toBe('/app/clientes/contas/ana-silva');
  });

  it('reconstrói o identificador interno sem expô-lo na URL', () => {
    expect(customerIdFromRoute('organization', 'aurora')).toBe('organization:aurora');
    expect(customerIdFromRoute('user', 'ana%20silva')).toBe('user:ana silva');
    expect(customerIdFromRoute('user', '%')).toBeNull();
  });

  it('redireciona rotas legadas para o caminho canônico', () => {
    expect(legacyCustomerDetailPath('organization%3Aaurora', 'usuarios')).toBe('/app/clientes/organizacoes/aurora/usuarios');
    expect(legacyCustomerDetailPath('%')).toBe('/app/clientes');
  });
  it('leva o membro legado para a equipe da organização, sem abrir outro painel', () => {
    expect(legacyCustomerMemberPath('organization%3Aaurora', 'ana%20silva'))
      .toBe('/app/clientes/organizacoes/aurora/equipe?membro=ana%20silva');
    expect(legacyCustomerMemberPath('%', 'ana')).toBe('/app/clientes');
  });
});
