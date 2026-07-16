import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/supabase';

export interface PlanMutationInput { planId:string; plan:Json; commercial:Json; features:Json; limits:Json; sla:Json; reason:string }
export function usePlanMutation(){return useAdministrativeMutation<PlanMutationInput,unknown>({mutationFn:async(input,operationId)=>{const{data,error}=await supabase.rpc('mutate_internal_plan',{p_plan_id:input.planId,p_plan:input.plan,p_commercial:input.commercial,p_features:input.features,p_limits:input.limits,p_sla:input.sla,p_reason:input.reason,p_operation_id:operationId});if(error)throw error;return data;},invalidate:[['plan-catalog'],['internal-dashboard'],['audit-timeline']]});}
