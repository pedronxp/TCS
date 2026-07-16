import { useQuery } from '@tanstack/react-query';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { supabase } from '@/lib/supabase';
import type { CustomerOperations } from '@/types/domain';

export function parseCustomerOperations(value: import('@/types/supabase').Json | null): CustomerOperations {
  const root = jsonObject(value);
  return {
    appointments: jsonArray(root?.appointments).map(jsonObject).filter(Boolean).map(row => ({ id:jsonString(row?.id)||'',title:jsonString(row?.title)||'Agendamento',status:jsonString(row?.status)||'pendente',scheduled_at:jsonString(row?.scheduled_at),agent_name:jsonString(row?.agent_name),address:jsonString(row?.address),latitude:jsonNumber(row?.latitude),longitude:jsonNumber(row?.longitude) })),
    mapPoints: jsonArray(root?.map_points).map(jsonObject).filter(Boolean).map(row => ({ id:jsonString(row?.id)||'',protocol:jsonString(row?.protocol),risk:jsonString(row?.risk),status:jsonString(row?.status),occurred_at:jsonString(row?.occurred_at),latitude:jsonNumber(row?.latitude),longitude:jsonNumber(row?.longitude),address:jsonString(row?.address) })),
    documents: jsonArray(root?.documents).map(jsonObject).filter(Boolean).map(row => ({ id:jsonString(row?.id)||'',protocol:jsonString(row?.protocol),risk:jsonString(row?.risk),generated_at:jsonString(row?.generated_at),url:jsonString(row?.url)||'',storage_location:jsonString(row?.storage_location) })),
    reports: jsonArray(root?.reports).map(jsonObject).filter(Boolean).map(row => ({ id:jsonString(row?.id)||'',protocol:jsonString(row?.protocol),risk:jsonString(row?.risk),score:jsonNumber(row?.score),form_id:jsonString(row?.form_id),form_version:jsonNumber(row?.form_version),generated_at:jsonString(row?.generated_at) })),
  };
}

export function useCustomerOperations(customerId:string){return useQuery({queryKey:['customer-operations',customerId],enabled:Boolean(customerId),queryFn:async()=>{const{data,error}=await supabase.rpc('get_internal_customer_operations',{p_customer_id:customerId});if(error)throw error;return parseCustomerOperations(data);}});}
