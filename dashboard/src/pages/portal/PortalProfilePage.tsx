import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Link, LogOut, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { supabase } from '@/lib/supabase';

interface PortalSession {
  id: string;
  device_name: string;
  platform: string;
  last_heartbeat_at: string;
  last_ip_masked: string | null;
  mac_masked: string | null;
}

export function PortalProfilePage() {
  const { access, user, signOut, linkGoogleIdentity } = usePortalAuth();
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [sendingPasswordLink, setSendingPasswordLink] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [linkingNotice, setLinkingNotice] = useState(false);
  const query = useQuery({
    queryKey: ['portal', 'sessions', access?.userId, access?.accountKind, access?.organizationId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('portal_list_own_sessions');
      if (error) throw new Error(error.message);
      return (Array.isArray(data) ? data : []) as unknown as PortalSession[];
    },
  });

  useEffect(() => {
    const marker = window.sessionStorage.getItem('tcs.portal.google-linking');
    const hasGoogle = user?.identities?.some((identity) => identity.provider === 'google') ?? false;
    if (!marker || !hasGoogle) return;
    window.sessionStorage.removeItem('tcs.portal.google-linking');
    setLinkingNotice(true);
    const timer = window.setTimeout(async () => {
      await supabase.auth.signOut({ scope: 'local' });
      window.location.assign('/entrar');
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [user]);

  if (!access) return null;
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
    window.sessionStorage.setItem('tcs.portal.google-linking', '1');
    const message = await linkGoogleIdentity();
    if (message) {
      window.sessionStorage.removeItem('tcs.portal.google-linking');
      setGoogleMessage(message);
    }
    setGoogleLoading(false);
  }

  async function createTcsPassword() {
    if (!user?.email) return;
    setSendingPasswordLink(true);
    setPasswordMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setSendingPasswordLink(false);
    const errorText = error?.message ?? '';
    setPasswordMessage(error
      ? /rate limit|too many|over_email_send_rate_limit/i.test(errorText)
        ? 'O envio de e-mail atingiu o limite temporário. Aguarde alguns minutos antes de solicitar outro link.'
        : 'Não foi possível enviar o link agora. Tente novamente em alguns minutos.'
      : 'Enviamos um link seguro para você criar uma senha exclusiva da TCS. Não use a senha do Google.');
  }

  return (
    <div className="page-stack">
      {logoutMessage && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{logoutMessage}</p>}
      <header><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Conta</p><h1 className="mt-2 text-3xl font-semibold">Perfil e segurança</h1><p className="mt-2 text-sm text-muted-foreground">Identidade, vínculo e sessões da sua própria conta.</p></header>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Dados da conta</CardTitle></CardHeader><CardContent className="space-y-4"><Info label="Nome" value={access.displayName} /><Info label="E-mail verificado" value={user?.email ?? '—'} /><Info label="Experiência" value={access.accountKind === 'organization' ? `Municipal · ${access.role}` : 'Agente individual'} /><div><Button variant="outline" disabled={loggingOut} onClick={() => void logoutEverywhere()}><LogOut />{loggingOut ? 'Saindo…' : 'Sair de todos os dispositivos'}</Button><p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">A saída global revoga os tokens de atualização. Tokens de acesso já emitidos em outros dispositivos podem permanecer válidos até expirar.</p></div></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck />Proteção</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Permissões e escopo são recalculados no servidor a cada sessão.</p><p>Documentos usam links temporários e auditáveis.</p>{googleLinked ? (<div className="space-y-3 rounded-md border border-success/30 bg-success-soft p-3 text-foreground"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" /><div><p className="font-semibold">Conta Google conectada</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Sua conta da TCS está vinculada ao Google <strong className="text-foreground">{user?.email}</strong>. Você também pode criar uma senha exclusiva da TCS para entrar com e-mail e senha.</p></div></div><Button variant="outline" size="sm" disabled={sendingPasswordLink} onClick={() => void createTcsPassword()}>{sendingPasswordLink ? 'Enviando link…' : 'Criar senha TCS'}</Button></div>) : (<Button variant="outline" disabled={googleLoading} onClick={() => void linkGoogle()}><Link />{googleLoading ? 'Abrindo Google…' : 'Vincular conta Google'}</Button>)}{googleMessage && <p role="alert" className="rounded-md border border-warning/30 bg-warning-soft p-3 text-foreground">{googleMessage}</p>}{passwordMessage && <p role="status" className="rounded-md border border-border bg-card p-3 text-foreground">{passwordMessage}</p>}</CardContent></Card>
      </section>
      <Dialog open={linkingNotice} onOpenChange={setLinkingNotice}><DialogContent className="max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />Google autenticado</DialogTitle><DialogDescription>Sua conta Google foi vinculada com sucesso. Estamos encaminhando você para a tela de login.</DialogDescription></DialogHeader><div className="flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status"><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent align-middle motion-reduce:animate-none" aria-hidden="true" />Direcionando…</div></DialogContent></Dialog>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><MonitorSmartphone />Registros de dispositivos</CardTitle><p className="text-sm text-muted-foreground">Histórico operacional dos acessos. Os identificadores de rede são mostrados de forma mascarada para preservar sua privacidade.</p></CardHeader><CardContent>{query.isLoading && <p className="text-sm text-muted-foreground">Carregando registros…</p>}{query.isError && <div className="space-y-3 text-sm text-destructive" role="alert"><p>Não foi possível carregar os registros.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}<ul className="divide-y">{query.data?.map((session) => <li key={session.id} className="py-4"><p className="text-sm font-semibold">{session.device_name}</p><p className="mt-1 text-xs text-muted-foreground">{session.platform} · atividade em {new Date(session.last_heartbeat_at).toLocaleString('pt-BR')}</p><p className="mt-2 text-xs text-muted-foreground">Último IP: {session.last_ip_masked ?? 'Não disponível'} · MAC: {session.mac_masked ?? 'Não disponível'}</p></li>)}</ul>{query.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum dispositivo registrado como ativo.</p>}</CardContent></Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}
