import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/Card';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { supabase } from '@/lib/supabase';

type InvitePreview = { organization_name?: string; email_hint?: string; role?: string; expires_at?: string; status?: string };

export function InviteAcceptancePage() {
  const { token } = useParams();
  const { session, refreshAccess } = usePortalAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const portalRpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    void portalRpc('portal_get_invite_preview', { p_token: token }).then(({ data, error }) => {
      setLoading(false);
      if (error) setMessage('Este convite não está disponível.');
      else setPreview((data ?? {}) as InvitePreview);
    });
  }, [token]);

  async function accept() {
    if (!token) return;
    setLoading(true);
    const portalRpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
    const { error } = await portalRpc('portal_accept_organization_invite', { p_token: token });
    if (error) {
      setMessage(error.message.includes('email_mismatch') ? 'Entre com o mesmo e-mail verificado que recebeu o convite.' : 'Não foi possível aceitar este convite.');
      setLoading(false);
      return;
    }
    await refreshAccess();
    navigate('/portal/municipal', { replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader><h1 className="min-w-0 text-[22px] font-semibold leading-[1.4]">Convite para o portal municipal</h1><CardDescription>Confira o vínculo antes de entrar na operação.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          {loading && <p className="text-sm text-muted-foreground">Validando convite…</p>}
          {preview && (
            <dl className="grid gap-3 rounded-md bg-secondary p-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">Organização</dt><dd className="mt-1 font-semibold">{preview.organization_name}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Papel</dt><dd className="mt-1 font-semibold">{preview.role}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Destinatário</dt><dd className="mt-1 font-semibold">{preview.email_hint}</dd></div>
            </dl>
          )}
          {message && <p className="rounded-md bg-destructive-soft p-3 text-sm text-destructive" role="alert">{message}</p>}
          {!session ? <Button asChild className="w-full"><Link to={`/entrar?returnTo=${encodeURIComponent(`/convite/${token}`)}`}>Entrar para aceitar</Link></Button> : <Button className="w-full" onClick={() => void accept()} disabled={loading || !preview}>Aceitar convite</Button>}
          <Button asChild variant="ghost" className="w-full"><Link to="/">Voltar ao site</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
