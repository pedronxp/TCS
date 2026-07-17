import { COMMERCIAL_PLANS, formatPlanPrice, priceForCycle } from '../CommercialPlans';

describe('CommercialPlans', () => {
  it('publishes the five approved commercial plans', () => {
    expect(COMMERCIAL_PLANS.map(plan => plan.code)).toEqual([
      'individual_basic',
      'individual_professional',
      'municipal_basic',
      'municipal_professional',
      'municipal_complete',
    ]);
  });

  it('uses the approved annual and monthly prices', () => {
    const basic = COMMERCIAL_PLANS[0];
    expect(priceForCycle(basic, 'monthly')).toBe(7990);
    expect(priceForCycle(basic, 'annual')).toBe(79900);
    expect(priceForCycle(basic, 'custom')).toBeNull();
  });

  it('formats prices in Brazilian reais', () => {
    expect(formatPlanPrice(14990)).toContain('149,90');
  });
});
