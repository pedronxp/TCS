import { isSubscriptionLimitError, subscriptionLimitSyncMessage } from '../subscriptionSync';

describe('subscription limit during offline sync', () => {
  it('recognizes the database trigger response', () => {
    const error = { message: 'inspection_creation_blocked', details: '{"allowed":false,"reason":"limit_reached"}' };
    expect(isSubscriptionLimitError(error)).toBe(true);
    expect(subscriptionLimitSyncMessage(error)).toContain('permanece salva');
  });

  it('does not classify network errors as a commercial block', () => {
    expect(isSubscriptionLimitError({ message: 'network error' })).toBe(false);
  });
});
