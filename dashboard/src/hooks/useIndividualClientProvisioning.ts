import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type IndividualProvisioningMode = 'email_invite' | 'initial_password';

interface ProvisioningInput {
  name: string;
  email: string;
  mode: IndividualProvisioningMode;
  password?: string;
  reason: string;
}

interface ProvisioningResponse {
  ok: boolean;
  customer_id?: string;
  user_id?: string;
  status?: string;
  error?: string;
}

const messages: Record<string, string> = {
  aal2_required: 'Confirme o MFA antes de continuar.',
  email_already_registered: 'Este e-mail já possui uma conta de autenticação.',
  auth_provisioning_failed: 'O Supabase Auth não conseguiu criar a conta ou enviar o convite.',
  profile_provisioning_failed: 'A autenticação foi revertida porque o perfil do cliente não pôde ser criado.',
  weak_password: 'A senha deve ter ao menos 8 caracteres, uma letra e um número.',
  forbidden: 'Seu perfil não possui permissão para criar clientes individuais.',
};

async function responseError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.clone().json() as ProvisioningResponse;
      return messages[payload.error ?? ''] ?? payload.error ?? error.message;
    } catch {
      return error.message;
    }
  }
  return error instanceof Error ? error.message : 'Não foi possível criar o cliente individual.';
}

export function useIndividualClientProvisioning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProvisioningInput) => {
      const { data, error } = await supabase.functions.invoke<ProvisioningResponse>(
        'provision-individual-client',
        {
          body: {
            ...input,
            operation_id: crypto.randomUUID(),
          },
        },
      );
      if (error) throw new Error(await responseError(error));
      if (!data?.ok || !data.customer_id) {
        throw new Error(messages[data?.error ?? ''] ?? data?.error ?? 'Provisionamento não concluído.');
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['internal-customers'] });
    },
  });
}
