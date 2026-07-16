interface SupabaseLikeError { message?: string; details?: string; code?: string }

export function isSubscriptionLimitError(error: SupabaseLikeError | null | undefined): boolean {
  const combined = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return combined.includes('inspection_creation_blocked') || combined.includes('limit_reached');
}

export function subscriptionLimitSyncMessage(error: SupabaseLikeError): string {
  if (!isSubscriptionLimitError(error)) return error.message || 'Erro desconhecido';
  return 'Limite da assinatura atingido. A vistoria permanece salva neste aparelho e será sincronizada após liberação de limite.';
}
