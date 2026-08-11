import { useQuery } from '@tanstack/react-query';
import { Link, LogOut, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
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
  const { access, user, signOut, linkGoogleIdentity } = usePortalAuth();
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [endingSession, setEndingSession] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const query = useQuery({
    queryKey: ['portal', 'sessions', access?.userId, access?.accountKind, access?.organizationId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('portal_list_own_sessions');
      if (error) throw new Error(error.message);
      return (Array.isArray(data) ? data : []) as unknown as PortalSession[];
    },
  });
  if (!access) return null;

  async function endSession(id: string) {
    setEndingSession(id);
    setSessionMessage(null);
    const { data, error } = await supabase.rpc('portal_end_own_session', { p_session_id: id });
    setEndingSession(null);
    if (error || data !== true) {
      setSessionMessage(data === false && !error
        ? 'Este registro já não estava ativo. Nenhuma sessão de autenticação foi alterada.'
        : 'Não foi possível encerrar este registro de dispositivo.');
      return;
    }
    setSessionMessage('Registro operacional encerrado. Isso não revoga imediatamente o token de autenticação do dispositivo.');
    void query.refetch();
  }

  const googleLinked = user?.identities?.some((identity) => identity.provider === 'google') ?? false;
  async function logoutEverywhere() {
    setLoggingOut(true);
    setLogoutMessage(null);
    try {
      await signOut();
    } catch {
      setLogoutMessage('Não foi possível concluir a saída global. Esta sessão continua aberta; tente novamente.');
      setLoggingOut(false);
    }
  }

  async function linkGoogle() {
    setGoogleLoading(true);
    setGoogleMessage(null);
    const message = await linkGoogleIdentity();
    setGoogleMessage(message ?? 'Conta Google vinculada. Seus papéis e permissões não foram alterados.');
    setGoogleLoading(false);
  }

  return (
    <div className="page-stack">
      {sessionMessage && <p className="rounded-md border bg-card p-3 text-sm" role="status">{sessionMessage}</p>}
      {logoutMessage && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{logoutMessage}</p>}
      {endingSession && <p className="sr-only" role="status">Encerrando sessão…</p>}
      <header><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Conta</p><h1 className="mt-2 text-3xl font-semibold">Perfil e segurança</h1><p className="mt-2 text-sm text-muted-foreground">Identidade, vínculo e sessões da sua própria conta.</p></header>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Dados da conta</CardTitle></CardHeader><CardContent className="space-y-4"><Info label="Nome" value={access.displayName} /><Info label="E-mail verificado" value={user?.email ?? '—'} /><Info label="Experiência" value={access.accountKind === 'organization' ? `Municipal · ${access.role}` : 'Individual'} /><div><Button variant="outline" disabled={loggingOut} onClick={() => void logoutEverywhere()}><LogOut />{loggingOut ? 'Saindo…' : 'Sair de todos os dispositivos'}</Button><p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">A saída global revoga os tokens de atualização. Tokens de acesso já emitidos em outros dispositivos podem permanecer válidos até expirar.</p></div></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck />Proteção</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Permissões e escopo são recalculados no servidor a cada sessão.</p><p>Documentos usam links temporários e auditáveis.</p><p>Para alterar senha ou MFA, use o fluxo seguro enviado ao seu e-mail.</p><Button variant="outline" disabled={googleLinked || googleLoading} onClick={() => void linkGoogle()}><Link />{googleLinked ? 'Google vinculado' : googleLoading ? 'Abrindo Google…' : 'Vincular conta Google'}</Button>{googleMessage && <p role="status">{googleMessage}</p>}</CardContent></Card>
      </section>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><MonitorSmartphone />Registros de dispositivos</CardTitle><p className="text-sm text-muted-foreground">Encerrar um registro interrompe apenas o acompanhamento operacional da TCS. O token de autenticação pode permanecer válido até expirar.</p></CardHeader><CardContent>{query.isLoading && <p className="text-sm text-muted-foreground">Carregando registros…</p>}{query.isError && <div className="space-y-3 text-sm text-destructive" role="alert"><p>Não foi possível carregar os registros.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}<ul className="divide-y">{query.data?.map((session) => <li key={session.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{session.device_name}</p><p className="mt-1 text-xs text-muted-foreground">{session.platform} · atividade em {new Date(session.last_heartbeat_at).toLocaleString('pt-BR')}</p></div><Button variant="outline" size="sm" className="min-h-11" disabled={endingSession !== null} onClick={() => void endSession(session.id)}>{endingSession === session.id ? 'Encerrando registro…' : 'Encerrar registro'}</Button></li>)}</ul>{query.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum dispositivo registrado como ativo.</p>}</CardContent></Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}
