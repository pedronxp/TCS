import { useAdministrativeMutation } from './useAdministrativeMutation';
import { customerKeys } from './customerKeys';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/supabase';

export interface SubscriptionMutationVariables {
  customerId: string;
  subscriptionId: string | null;
  action: 'create' | 'update';
  payload: Json;
  reason: string;
}

export function useSubscriptionMutation() {
  return useAdministrativeMutation<SubscriptionMutationVariables, Json>({
    mutationFn: async (variables, operationId) => {
      const { data, error } = await supabase.rpc('mutate_internal_subscription', {
        p_customer_id: variables.customerId,
        p_subscription_id: variables.subscriptionId ?? '',
        p_action: variables.action,
        p_payload: variables.payload,
        p_reason: variables.reason,
        p_operation_id: operationId,
      });
      if (error) throw error;
      return data;
    },
    invalidate: [['internal-subscriptions'], customerKeys.all],
  });
}
