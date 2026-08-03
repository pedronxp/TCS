import { customerLifecycleMessage, CUSTOMER_ONBOARDING_ITEMS } from '../CustomerOnboardingService';

describe('CustomerOnboardingService', () => {
  it('keeps commercial activation distinct from trial', () => {
    expect(customerLifecycleMessage('trial')).toContain('contratação definitiva');
    expect(customerLifecycleMessage('active')).toContain('ativo');
  });

  it('only lets the customer explicitly confirm configuration', () => {
    expect(CUSTOMER_ONBOARDING_ITEMS.filter((item) => item.customerManaged).map((item) => item.key))
      .toEqual(['configuration']);
  });
});
