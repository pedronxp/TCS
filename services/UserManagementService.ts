import { supabase } from '../utils/supabase';
import {
  EMPTY_USER_DELETION_IMPACT,
  UserDeletionImpact,
} from '../utils/userDeletion';

const MASTER_DELETE_USER_MISSING_RPC_MESSAGE =
  'A função de exclusão de usuário não está disponível no Supabase. Aplique a migração 20260414_master_delete_user.sql no projeto remoto e tente novamente.';
const MASTER_DELETE_USER_STALE_RPC_MESSAGE =
  'A função de exclusão de usuário no Supabase está desatualizada para o campo vistorias.agenteUid. Reaplique a SQL corrigida de 20260414_master_delete_user.sql no projeto remoto e tente novamente.';

async function readExactCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

function normalizeDeleteUserRpcError(message: string): string {
  if (
    message.includes('Could not find the function public.master_delete_user') ||
    message.includes('could not find the function public.master_delete_user')
  ) {
    return MASTER_DELETE_USER_MISSING_RPC_MESSAGE;
  }

  if (
    message.includes('operator does not exist: text = uuid') ||
    message.includes('operator does not exist: uuid = text')
  ) {
    return MASTER_DELETE_USER_STALE_RPC_MESSAGE;
  }

  return message;
}

export async function fetchUserDeletionImpact(targetUserId: string): Promise<UserDeletionImpact> {
  const [
    vistorias,
    agendamentosCriados,
    agendamentosComoAgente,
    atribuicoesComoSupervisor,
    atribuicoesComoAgente,
  ] = await Promise.all([
    readExactCount(
      supabase.from('vistorias').select('*', { count: 'exact', head: true }).eq('agenteUid', targetUserId)
    ),
    readExactCount(
      supabase.from('agendamentos').select('*', { count: 'exact', head: true }).eq('criado_por_uid', targetUserId)
    ),
    readExactCount(
      supabase.from('agendamentos').select('*', { count: 'exact', head: true }).eq('agente_uid', targetUserId)
    ),
    readExactCount(
      supabase.from('atribuicoes').select('*', { count: 'exact', head: true }).eq('supervisor_uid', targetUserId)
    ),
    readExactCount(
      supabase.from('atribuicoes').select('*', { count: 'exact', head: true }).eq('agente_uid', targetUserId)
    ),
  ]);

  return {
    vistorias,
    agendamentosCriados,
    agendamentosComoAgente,
    atribuicoesComoSupervisor,
    atribuicoesComoAgente,
  };
}

export async function deleteUserAsMasterAdmin(
  targetUserId: string,
  deleteVistorias = false
): Promise<void> {
  const { error } = await supabase.rpc('master_delete_user', {
    p_target_uid: targetUserId,
    p_delete_vistorias: deleteVistorias,
  });

  if (error) {
    throw new Error(normalizeDeleteUserRpcError(error.message));
  }
}

export function getSafeDeletionImpact(value?: Partial<UserDeletionImpact> | null): UserDeletionImpact {
  return {
    ...EMPTY_USER_DELETION_IMPACT,
    ...(value ?? {}),
  };
}
