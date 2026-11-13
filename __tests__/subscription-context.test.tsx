import React from 'react';
import { Text } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { SubscriptionProvider, useSubscription } from '../context/SubscriptionContext';

let mockActor = 'actor-a';
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: mockActor } } }) }));
jest.mock('../utils/supabase', () => ({ supabase: { rpc: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
let refresh: () => Promise<void>;
function Consumer() {
  const value = useSubscription(); refresh = value.refresh;
  return <Text>{`${value.context?.plan?.name || 'none'}:${value.hasFeature('paid')}`}</Text>;
}
const verified = { enforced: true, organization: null, subscription: { status: 'active', period_end: '2099-01-01' }, plan: { name: 'Verified' }, features: { paid: true }, usage: [] };
beforeEach(() => { jest.clearAllMocks(); mockActor = 'actor-a'; });
it('keeps the verified account during refresh failure and isolates a new actor', async () => {
  jest.mocked(supabase.rpc).mockResolvedValueOnce({ data: verified, error: null } as never).mockRejectedValue(new Error('offline'));
  const view = render(<SubscriptionProvider><Consumer /></SubscriptionProvider>);
  await screen.findByText('Verified:true');
  await act(async () => { await refresh(); });
  expect(screen.getByText('Verified:true')).toBeTruthy();
  mockActor = 'actor-b';
  view.rerender(<SubscriptionProvider><Consumer /></SubscriptionProvider>);
  await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledWith('@subscription_context:actor-b'));
  expect(screen.getByText('none:false')).toBeTruthy();
});
it('restores only this actor cache offline and rejects elapsed cached grants', async () => {
  jest.mocked(supabase.rpc).mockRejectedValue(new Error('offline'));
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({ ...verified, subscription: { status: 'active', period_end: '2020-01-01' } }));
  render(<SubscriptionProvider><Consumer /></SubscriptionProvider>);
  await screen.findByText('Verified:false');
  expect(AsyncStorage.getItem).toHaveBeenCalledWith('@subscription_context:actor-a');
});
