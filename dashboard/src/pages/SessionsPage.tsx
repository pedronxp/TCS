import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui/AsyncState';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { supabase } from '@/lib/supabase';

interface SessionRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  device_name: string | null;
  platform: string;
  status: string;
  last_heartbeat_at: string;
  organizations: { display_name: string } | null;
}

export function SessionsPage() {
  const [status, setStatus] = useState('active');
  const [platform, setPlatform] = useState('');
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const query = useQuery({
    queryKey: ['internal-sessions', status, platform],
    queryFn: async () => {
      let request = supabase
        .from('active_sessions')
        .select('id,user_id,organization_id,device_name,platform,status,last_heartbeat_at,organizations(display_name)')
        .order('last_heartbeat_at', { ascending: false })
        .limit(200);
      if (status) request = request.eq('status', status);
      if (platform) request = request.eq('platform', platform);
      const { data, error } = await request;
      if (error) throw error;
      return data satisfies SessionRow[];
    },
  });
  const terminate = useAdministrativeMutation<{ id: string; reason: string }, boolean>({
    mutationFn: async ({ id, reason }) => {
      const { data, error } = await supabase.rpc('end_active_session', {
        p_session_id: id,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    invalidate: [['internal-sessions']],
  });

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Sessões</h2>
          <p className="mt-1 text-sm text-slate-500">Dispositivos, plataforma, heartbeat e encerramento remoto auditado.</p>
        </div>
        <div className="flex gap-2">
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar status" className="h-9 rounded-lg border bg-white px-3 text-sm">
            <option value="">Todos status</option>
            {['active', 'ended', 'expired', 'revoked', 'replaced'].map((value) => <option key={value}>{value}</option>)}
          </select>
          <select value={platform} onChange={(event) => setPlatform(event.target.value)} aria-label="Filtrar plataforma" className="h-9 rounded-lg border bg-white px-3 text-sm">
            <option value="">Todas plataformas</option>
            {['android', 'ios', 'web', 'unknown'].map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
      </div>

      {query.isLoading ? <LoadingState /> : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState title="Nenhuma sessão" description="Não há sessões para os filtros selecionados." />
      ) : (
        <div className="space-y-3">
          {query.data.map((session) => (
            <article key={session.id} className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-4">
              <MonitorSmartphone className="h-5 w-5 text-blue-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{session.device_name || session.platform}</p>
                <p className="text-xs text-slate-500">
                  {session.organizations?.display_name || session.user_id.slice(0, 8)} · {new Date(session.last_heartbeat_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <StatusBadge value={session.status} />
              {session.status === 'active' && (
                <button onClick={() => setSelected(session)} aria-label={`Encerrar sessão de ${session.device_name || session.platform}`} className="rounded-lg border border-red-200 p-2 text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      <HighRiskDialog
        open={Boolean(selected)}
        title="Encerrar sessão remotamente"
        description="O dispositivo perderá acesso e a ação será registrada na auditoria."
        confirmLabel="Encerrar sessão"
        onClose={() => setSelected(null)}
        onConfirm={async (reason) => {
          if (!selected) return;
          const result = await terminate.mutateAsync({ id: selected.id, reason });
          if (!result.ok) throw new Error(result.error);
        }}
      />
    </section>
  );
}
