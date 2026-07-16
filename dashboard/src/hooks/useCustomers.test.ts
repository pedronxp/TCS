import { describe, expect, it } from 'vitest';
import { customerKeys } from './customerKeys';

describe('customerKeys', () => {
  it('isola busca, status e página na chave de cache', () => {
    expect(customerKeys.list('Belém', 'active', 2)).toEqual([
      'internal-customers',
      'list',
      { search: 'Belém', status: 'active', page: 2 },
    ]);
  });

  it('não reutiliza a chave após troca de filtro ou página', () => {
    expect(customerKeys.list('A', '', 0)).not.toEqual(customerKeys.list('B', '', 0));
    expect(customerKeys.list('A', '', 0)).not.toEqual(customerKeys.list('A', '', 1));
  });
});
