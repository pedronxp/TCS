import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { MutationResult } from '@/types/domain';

export function useAdministrativeMutation<TVariables, TData>({
  mutationFn,
  invalidate,
}: {
  mutationFn: (variables: TVariables, operationId: string) => Promise<TData>;
  invalidate: QueryKey[];
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: TVariables): Promise<MutationResult<TData>> => {
      const operationId = crypto.randomUUID();
      try {
        const data = await mutationFn(variables, operationId);
        return { ok: true, data, operationId };
      } catch (error) {
        return {
          ok: false,
          error: errorMessage(error),
          operationId,
        };
      }
    },
    onSuccess: async (result) => {
      if (!result.ok) return;
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Operação não concluída.';
}
