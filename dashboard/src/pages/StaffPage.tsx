import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { DataTable, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui/AsyncState';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { supabase } from '@/lib/supabase';

interface Draft { userId: string; role: string; status: string }

export function StaffPage() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const query = useQuery({
    queryKey: ['internal-staff'],
    queryFn: async () => {
      const { data, error } = await supabase.from('internal_staff').select('user_id,role,status,display_name,created_at,updated_at').order('created_at');
      if (error) throw error;
      return data;
    },
  });
  const mutation = useAdministrativeMutation<{ draft: Draft; reason: string }, unknown>({
    mutationFn: async (input, operationId) => {
      const { data, error } = await supabase.rpc('manage_internal_staff', { p_user_id: input.draft.userId, p_role: input.draft.role, p_status: input.draft.status, p_reason: input.reason, p_operation_id: operationId });
      if (error) throw error;
      return data;
    },
    invalidate: [['internal-staff'], ['audit-timeline']],
  });
  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} />;
  return <section><div className="mb-5 flex justify-between gap-3"><div><h2 className="text-2xl font-bold">Equipe interna</h2><p className="mt-1 text-sm text-slate-500">Donos e programadores com estado explícito e gestão auditada.</p></div><button onClick={() => { setDraft({ userId: '', role: 'developer', status: 'active' }); setConfirming(false); }} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" />Adicionar staff</button></div>{!query.data?.length ? <EmptyState title="Sem staff" description="Nenhum perfil interno foi cadastrado." /> : <DataTable headers={['Nome', 'User ID', 'Papel', 'Status', 'Atualização', 'Ações']} minWidth={880}>{query.data.map((item) => <tr key={item.user_id} className="border-t"><td className="p-3 font-semibold">{item.display_name || 'Sem nome'}</td><td className="p-3 font-mono text-xs">{item.user_id}</td><td className="p-3"><StatusBadge value={item.role} /></td><td className="p-3"><StatusBadge value={item.status} /></td><td className="p-3 text-xs">{new Date(item.updated_at).toLocaleString('pt-BR')}</td><td className="p-3"><button onClick={() => { setDraft({ userId: item.user_id, role: item.role, status: item.status }); setConfirming(false); }} className="rounded-lg border px-3 py-1 text-xs font-semibold">Gerenciar</button></td></tr>)}</DataTable>}{draft && !confirming && <StaffDraftDialog draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onContinue={() => setConfirming(true)} />}{draft && <HighRiskDialog open={confirming} title="Confirmar alteração de staff" description="A alteração de acesso exige MFA e será registrada com estado anterior e posterior." confirmLabel="Salvar staff" onClose={() => setConfirming(false)} onConfirm={async (reason) => { const result = await mutation.mutateAsync({ draft, reason }); if (!result.ok) throw new Error(result.error); setConfirming(false); setDraft(null); }} />}</section>;
}

function StaffDraftDialog({ draft, onChange, onClose, onContinue }: { draft: Draft; onChange: (draft: Draft) => void; onClose: () => void; onContinue: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, ref, onClose);
  const valid = /^[0-9a-f-]{36}$/i.test(draft.userId);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><div ref={ref} role="dialog" aria-modal="true" aria-labelledby="staff-dialog" className="w-full max-w-md rounded-2xl bg-white p-6"><h3 id="staff-dialog" className="text-lg font-bold">Gerenciar staff</h3><div className="mt-4 space-y-3"><label className="block text-sm"><span className="font-semibold">User ID do Supabase Auth</span><input value={draft.userId} onChange={(event) => onChange({ ...draft, userId: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-3 font-mono text-xs" /></label><label className="block text-sm"><span className="font-semibold">Papel</span><select value={draft.role} onChange={(event) => onChange({ ...draft, role: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-3"><option value="owner">owner</option><option value="developer">developer</option></select></label><label className="block text-sm"><span className="font-semibold">Status</span><select value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-3"><option value="active">active</option><option value="suspended">suspended</option><option value="removed">removed</option></select></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-4 py-2">Cancelar</button><button disabled={!valid} onClick={onContinue} className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-40">Continuar</button></div></div></div>;
}
