import { useAdministrativeMutation } from './useAdministrativeMutation';
import { customerKeys } from './customerKeys';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/supabase';

export interface OrganizationMutationVariables {
  organizationId: string | null;
  action: 'create' | 'update';
  payload: Json;
  reason: string;
}

interface OrganizationMutationResponse {
  ok: boolean;
  customer_id: string;
  organization_id: string;
}

export function useOrganizationMutation() {
  return useAdministrativeMutation<OrganizationMutationVariables, OrganizationMutationResponse>({
    mutationFn: async (variables, operationId) => {
      const { data, error } = await supabase.rpc('mutate_internal_organization', {
        p_organization_id: variables.organizationId ?? '',
        p_action: variables.action,
        p_payload: variables.payload,
        p_reason: variables.reason,
        p_operation_id: operationId,
      });
      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Resposta inválida ao salvar o cliente.');
      const customerId = typeof data.customer_id === 'string' ? data.customer_id : null;
      const organizationId = typeof data.organization_id === 'string' ? data.organization_id : null;
      if (!customerId || !organizationId) throw new Error('Identificador do cliente ausente na resposta.');
      return { ok: true, customer_id: customerId, organization_id: organizationId };
    },
    invalidate: [customerKeys.all],
  });
}
