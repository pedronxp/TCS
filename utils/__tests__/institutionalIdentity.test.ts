import { resolveInstitutionalIdentity } from '../institutionalIdentity';

describe('resolveInstitutionalIdentity', () => {
  it('returns trusted organization context for a municipal member', () => {
    const result = resolveInstitutionalIdentity({
      enforced: true,
      organization: { id: 'org-1', display_name: 'Defesa Civil de Exemplo', status: 'active' },
      membership: { role: 'agent', status: 'active' },
      subscription: null,
      plan: null,
      features: {},
      usage: [],
    });
    expect(result).toEqual({ organizationName: 'Defesa Civil de Exemplo', role: 'agent' });
  });

  it('keeps individual and unavailable contexts free of municipal identity', () => {
    expect(resolveInstitutionalIdentity(null)).toBeNull();
    expect(resolveInstitutionalIdentity({
      enforced: true,
      organization: null,
      membership: null,
      subscription: null,
      plan: { id: 'p1', code: 'individual', name: 'Individual', audience: 'individual', version: 1 },
      features: {},
      usage: [],
    })).toBeNull();
  });
});
