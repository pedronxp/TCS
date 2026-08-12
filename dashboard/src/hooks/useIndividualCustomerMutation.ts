import { useAdministrativeMutation } from './useAdministrativeMutation';
import { customerKeys } from './customerKeys';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/supabase';

export interface IndividualCustomerMutationVariables {
  customerId: string;
  payload: Json;
  reason: string;
}

interface IndividualCustomerMutationResponse {
  ok: boolean;
  customer_id: string;
}

export function useIndividualCustomerMutation() {
  return useAdministrativeMutation<IndividualCustomerMutationVariables, IndividualCustomerMutationResponse>({
    mutationFn: async (variables, operationId) => {
      const { data, error } = await supabase.rpc('mutate_internal_individual', {
        p_customer_id: variables.customerId,
        p_action: 'update',
        p_payload: variables.payload,
        p_reason: variables.reason,
        p_operation_id: operationId,
      });
      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Resposta inválida ao salvar o cliente.');
      const customerId = typeof data.customer_id === 'string' ? data.customer_id : null;
      if (!customerId) throw new Error('Identificador do cliente ausente na resposta.');
      return { ok: true, customer_id: customerId };
    },
    invalidate: [customerKeys.all],
  });
}
