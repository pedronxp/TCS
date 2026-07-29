import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { supabase } from '@/lib/supabase';
import type { CustomerOperations } from '@/types/domain';

export function parseCustomerOperations(value: import('@/types/supabase').Json | null): CustomerOperations {
  const root = jsonObject(value);
  return {
    appointments: jsonArray(root?.appointments).map(jsonObject).filter(Boolean).map(row => ({ id:jsonString(row?.id)||'',title:jsonString(row?.title)||'Agendamento',status:jsonString(row?.status)||'pendente',scheduled_at:jsonString(row?.scheduled_at),agent_name:jsonString(row?.agent_name),address:jsonString(row?.address),latitude:jsonNumber(row?.latitude),longitude:jsonNumber(row?.longitude),origin:jsonString(row?.origin)==='web'?'web':'app' })),
    mapPoints: jsonArray(root?.map_points).map(jsonObject).filter(Boolean).map(row => ({ id:jsonString(row?.id)||'',protocol:jsonString(row?.protocol),risk:jsonString(row?.risk),status:jsonString(row?.status),occurred_at:jsonString(row?.occurred_at),latitude:jsonNumber(row?.latitude),longitude:jsonNumber(row?.longitude),address:jsonString(row?.address) })),
    documents: jsonArray(root?.documents).map(jsonObject).filter(Boolean).map(row => {
      const rawStatus = jsonString(row?.document_status);
      const documentStatus = rawStatus === 'available' || rawStatus === 'missing_file'
        ? rawStatus
        : row?.downloadable === true ? 'available' : 'pending_generation';
      return {
        id: jsonString(row?.id) || '',
        inspection_id: jsonString(row?.inspection_id) || jsonString(row?.id) || '',
        protocol: jsonString(row?.protocol),
        risk: jsonString(row?.risk),
        occurred_at: jsonString(row?.occurred_at),
        generated_at: jsonString(row?.generated_at),
        storage_location: jsonString(row?.storage_location),
        document_status: documentStatus,
        downloadable: row?.downloadable === true,
        can_generate: row?.can_generate === true,
      };
    }),
    reports: jsonArray(root?.reports).map(jsonObject).filter(Boolean).map(row => ({ id:jsonString(row?.id)||'',protocol:jsonString(row?.protocol),risk:jsonString(row?.risk),score:jsonNumber(row?.score),form_id:jsonString(row?.form_id),form_version:jsonNumber(row?.form_version),generated_at:jsonString(row?.generated_at) })),
  };
}

export function useCustomerOperations(customerId:string){return useQuery({queryKey:['customer-operations',customerId],enabled:Boolean(customerId),queryFn:async()=>{const{data,error}=await supabase.rpc('get_internal_customer_operations',{p_customer_id:customerId});if(error)throw error;return parseCustomerOperations(data);}});}

export interface CreateCustomerAppointmentInput {
  customerId: string;
  title: string;
  scheduledAt: string;
  address?: string;
  agentId?: string;
  notes?: string;
  operationId: string;
}

export function useCreateCustomerAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCustomerAppointmentInput) => {
      const { data, error } = await supabase.rpc('create_internal_customer_appointment', {
        p_customer_id: input.customerId,
        p_title: input.title,
        p_scheduled_at: input.scheduledAt,
        p_address: input.address?.trim() || null,
        p_agent_id: input.agentId || null,
        p_notes: input.notes?.trim() || null,
        p_operation_id: input.operationId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, input) => queryClient.invalidateQueries({
      queryKey: ['customer-operations', input.customerId],
    }),
  });
}

export interface GenerateCustomerLaudoInput {
  customerId: string;
  inspectionId: string;
  force?: boolean;
}

export interface GeneratedCustomerLaudo {
  ok: boolean;
  reused: boolean;
  document_status: 'available';
  signed_url: string;
  expires_in: number;
  generated_at?: string;
}

interface GeneratedCustomerLaudoError {
  error?: string;
}

const generatedCustomerLaudoMessages: Record<string, string> = {
  authentication_required: 'Sua sessão expirou. Entre novamente para gerar o laudo.',
  invalid_session: 'Sua sessão expirou. Entre novamente para gerar o laudo.',
  generation_not_allowed: 'Seu perfil não possui autorização para gerar este laudo.',
  inspection_not_available: 'A vistoria não está disponível para geração do laudo.',
  invalid_storage_path: 'O destino do documento é inválido.',
  document_upload_failed: 'Não foi possível salvar o PDF. Tente novamente.',
  document_finalize_failed: 'O PDF foi criado, mas não foi possível finalizar o laudo. Tente novamente.',
  document_signing_failed: 'O laudo foi gerado, mas a visualização temporária não pôde ser aberta.',
  document_generation_failed: 'Não foi possível montar o PDF desta vistoria.',
};

async function generatedCustomerLaudoError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.clone().json() as GeneratedCustomerLaudoError;
      return generatedCustomerLaudoMessages[payload.error ?? '']
        ?? payload.error
        ?? error.message;
    } catch {
      return error.message;
    }
  }
  return error instanceof Error ? error.message : 'Não foi possível gerar o laudo.';
}

export function useGenerateCustomerLaudo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GenerateCustomerLaudoInput) => {
      const { data, error } = await supabase.functions.invoke('generate-inspection-laudo', {
        body: {
          customer_id: input.customerId,
          inspection_id: input.inspectionId,
          force: input.force === true,
        },
      });
      if (error) {
        throw new Error(await generatedCustomerLaudoError(error));
      }
      if (!data?.ok || !data?.signed_url) {
        throw new Error(
          generatedCustomerLaudoMessages[data?.error ?? '']
            ?? data?.error
            ?? generatedCustomerLaudoMessages.document_generation_failed,
        );
      }
      return data as GeneratedCustomerLaudo;
    },
    onSuccess: (_data, input) => queryClient.invalidateQueries({
      queryKey: ['customer-operations', input.customerId],
    }),
  });
}
