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

export interface CustomerFilters {
  search?: string;
  status?: string;
  municipio?: string;
  uf?: string;
  activityFrom?: string;
  activityTo?: string;
  page?: number;
  limit?: number;
}

export function useCustomers(filtersOrSearch: CustomerFilters | string = {}, legacyStatus = '', legacyPage = 0, legacyLimit = 25) {
  const { search = '', status = '', municipio = '', uf = '', activityFrom = '', activityTo = '', page = 0, limit = 25 } = typeof filtersOrSearch === 'string'
    ? { search: filtersOrSearch, status: legacyStatus, page: legacyPage, limit: legacyLimit }
    : filtersOrSearch;
  return useQuery({
    queryKey: customerKeys.list({ search, status, municipio, uf, activityFrom, activityTo, page }),
    queryFn: async (): Promise<CustomerPage> => {
      const { data, error } = await supabase.rpc('list_internal_customers', {
        p_search: search || undefined,
        p_status: status || undefined,
        p_municipio: municipio || undefined,
        p_state_code: uf || undefined,
        p_activity_from: activityFrom || undefined,
        p_activity_to: activityTo || undefined,
        p_limit: limit,
        p_offset: page * limit,
      });
      if (error) throw error;
      return parseCustomerPage(data);
    },
    placeholderData: keepPreviousData,
  });
}
