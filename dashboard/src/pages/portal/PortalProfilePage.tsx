import { useQuery } from '@tanstack/react-query';
import { LogOut, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { supabase } from '@/lib/supabase';

interface PortalSession {
  id: string;
  device_name: string;
  platform: string;
  status: string;
  started_at: string;
  last_heartbeat_at: string;
}

export function PortalProfilePage() {
  const { access, user, signOut } = usePortalAuth();
  const query = useQuery({
    queryKey: ['portal', 'sessions', access?.userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('portal_list_own_sessions');
      if (error) throw new Error(error.message);
      return (Array.isArray(data) ? data : []) as unknown as PortalSession[];
    },
  });
  if (!access) return null;

  async function endSession(id: string) {
    await supabase.rpc('portal_end_own_session', { p_session_id: id });
    void query.refetch();
  }

  return (
    <div className="page-stack">
      <header><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Conta</p><h1 className="mt-2 text-3xl font-semibold">Perfil e segurança</h1><p className="mt-2 text-sm text-muted-foreground">Identidade, vínculo e sessões da sua própria conta.</p></header>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Dados da conta</CardTitle></CardHeader><CardContent className="space-y-4"><Info label="Nome" value={access.displayName} /><Info label="E-mail verificado" value={user?.email ?? '—'} /><Info label="Experiência" value={access.accountKind === 'organization' ? `Municipal · ${access.role}` : 'Individual'} /><Button variant="outline" onClick={() => void signOut()}><LogOut />Sair desta sessão</Button></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck />Proteção</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Permissões e escopo são recalculados no servidor a cada sessão.</p><p>Documentos usam links temporários e auditáveis.</p><p>Para alterar senha ou MFA, use o fluxo seguro enviado ao seu e-mail.</p></CardContent></Card>
      </section>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><MonitorSmartphone />Sessões ativas</CardTitle></CardHeader><CardContent>{query.isLoading && <p className="text-sm text-muted-foreground">Carregando sessões…</p>}{query.isError && <p className="text-sm text-destructive" role="alert">Não foi possível carregar as sessões.</p>}<ul className="divide-y">{query.data?.map((session) => <li key={session.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{session.device_name}</p><p className="mt-1 text-xs text-muted-foreground">{session.platform} · atividade em {new Date(session.last_heartbeat_at).toLocaleString('pt-BR')}</p></div><Button variant="outline" size="sm" className="min-h-11" onClick={() => void endSession(session.id)}>Encerrar</Button></li>)}</ul>{query.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>}</CardContent></Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}
