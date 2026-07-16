import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { supabase } from '@/lib/supabase';
import type { CustomerPage, CustomerRecord } from '@/types/domain';
import type { Json } from '@/types/supabase';
import { customerKeys } from './customerKeys';

function parseCustomer(value: Json): CustomerRecord | null {
  const record = jsonObject(value);
  if (!record) return null;
  const customerId = jsonString(record.customer_id);
  const subjectId = jsonString(record.subject_id);
  const kind = jsonString(record.kind);
  const displayName = jsonString(record.display_name);
  const status = jsonString(record.status);
  if (!customerId || !subjectId || !displayName || !status || (kind !== 'organization' && kind !== 'individual')) {
    return null;
  }
  return {
    customer_id: customerId,
    subject_id: subjectId,
    kind,
    display_name: displayName,
    legal_name: jsonString(record.legal_name),
    municipality_name: jsonString(record.municipality_name),
    state_code: jsonString(record.state_code),
    status,
    contact_name: jsonString(record.contact_name),
    contact_email: jsonString(record.contact_email),
    subscription_status: jsonString(record.subscription_status),
    plan_name: jsonString(record.plan_name),
    active_users: jsonNumber(record.active_users) ?? 0,
    last_activity_at: jsonString(record.last_activity_at),
  };
}

function parseCustomerPage(value: Json | null): CustomerPage {
  const record = jsonObject(value);
  if (!record) throw new Error('Resposta inválida ao carregar clientes.');
  return {
    items: jsonArray(record.items).map(parseCustomer).filter((item): item is CustomerRecord => item !== null),
    total: jsonNumber(record.total) ?? 0,
    limit: jsonNumber(record.limit) ?? 25,
    offset: jsonNumber(record.offset) ?? 0,
  };
}

export function useCustomers(search = '', status = '', page = 0, limit = 25) {
  return useQuery({
    queryKey: customerKeys.list(search, status, page),
    queryFn: async (): Promise<CustomerPage> => {
      const { data, error } = await supabase.rpc('list_internal_customers', {
        p_search: search || undefined,
        p_status: status || undefined,
        p_limit: limit,
        p_offset: page * limit,
      });
      if (error) throw error;
      return parseCustomerPage(data);
    },
    placeholderData: keepPreviousData,
  });
}
