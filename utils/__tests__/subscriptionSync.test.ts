import { isRecoverableSubscriptionPeriodError, isSubscriptionLimitError, subscriptionLimitSyncMessage } from '../subscriptionSync';

describe('subscription limit during offline sync', () => {
  it('recognizes the database trigger response', () => {
    const error = { message: 'inspection_creation_blocked', details: '{"allowed":false,"reason":"limit_reached"}' };
    expect(isSubscriptionLimitError(error)).toBe(true);
    expect(subscriptionLimitSyncMessage(error)).toContain('permanece salva');
  });

  it('does not classify network errors as a commercial block', () => {
    expect(isSubscriptionLimitError({ message: 'network error' })).toBe(false);
  });

  it('hides a legacy subscription period constraint from the inspection list', () => {
    const error = { message: 'new row for relation "usage_counters" violates check constraint "usage_counters_check"' };

    expect(subscriptionLimitSyncMessage(error)).toBe(
      'Não foi possível atualizar o consumo da assinatura. A vistoria permanece salva e será sincronizada automaticamente.'
    );
  });

  it('identifies legacy period failures so exhausted inspections can retry after the repair', () => {
    expect(isRecoverableSubscriptionPeriodError({ message: 'new row for relation "usage_counters" violates check constraint "usage_counters_check"' })).toBe(true);
    expect(isRecoverableSubscriptionPeriodError({ message: 'network error' })).toBe(false);
  });
});
