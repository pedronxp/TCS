import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';

const RECOVERY_MARKER = 'tcs.portal.password-recovery';

export function PortalPasswordRecoveryPage({ mode }: { mode: 'request' | 'reset' }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [validRecovery, setValidRecovery] = useState<boolean | null>(mode === 'request' ? true : null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (mode !== 'reset') return;
    const verify = async () => {
      const { data } = await supabase.auth.getSession();
      const raw = window.sessionStorage.getItem(RECOVERY_MARKER);
      if (!raw || !data.session) return false;
      try {
        const marker = JSON.parse(raw) as { userId: string; expiresAt: number };
        return marker.userId === data.session.user.id && marker.expiresAt > Date.now();
      } catch {
        return false;
      }
    };
    const timer = window.setTimeout(() => {
      void verify().then(setValidRecovery);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [mode]);

  async function request(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const flags = await supabase.rpc('get_public_auth_capabilities');
    const publicFlags = flags.data as { password_recovery?: boolean } | null;
    if (flags.error || publicFlags?.password_recovery !== true) {
      setSubmitting(false);
      setMessage('A recuperação de senha está temporariamente indisponível.');
      return;
    }
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setSubmitting(false);
    setSent(true);
  }

  async function reset(event: FormEvent) {
    event.preventDefault();
    if (!validRecovery) return;
    if (password.length < 8 || password !== confirmation) {
      setMessage('Use ao menos 8 caracteres e confirme a mesma senha.');
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const update = await supabase.auth.updateUser({ password });
    if (update.error) {
      setSubmitting(false);
      setMessage('O link expirou ou não foi possível atualizar a senha.');
      return;
    }
    const audit = await supabase.rpc('record_password_recovery_completed', {
      p_other_sessions_revoked: revokeOthers,
    });
    if (audit.error) {
      setSubmitting(false);
      setMessage('Não foi possível concluir o registro de segurança.');
      return;
    }
    if (revokeOthers) await supabase.auth.signOut({ scope: 'others' });
    window.sessionStorage.removeItem(RECOVERY_MARKER);
    await supabase.auth.signOut({ scope: 'local' });
    setSubmitting(false);
    navigate('/entrar', { replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-semibold">{mode === 'request' ? 'Recuperar senha' : 'Criar nova senha'}</h1>
          <CardDescription>
            {mode === 'request'
              ? 'Enviaremos um link seguro. A resposta não informa se a conta existe.'
              : 'A alteração só é permitida durante uma sessão válida de recuperação.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>Se existir uma conta elegível, o link será enviado para o e-mail informado.</p>
              <Button asChild className="w-full"><Link to="/entrar">Voltar ao login</Link></Button>
            </div>
          ) : mode === 'request' ? (
            <form className="space-y-4" onSubmit={request}>
              <label className="block text-sm font-medium">E-mail<Input className="mt-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              {message && <p className="rounded-md bg-status-danger p-3 text-sm" role="alert">{message}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Enviando…' : 'Enviar link seguro'}</Button>
              <Button asChild variant="ghost" className="w-full"><Link to="/entrar">Voltar</Link></Button>
            </form>
          ) : validRecovery === null ? (
            <p className="text-sm text-muted-foreground">Validando sessão de recuperação…</p>
          ) : !validRecovery ? (
            <div className="space-y-4">
              <p className="rounded-md bg-status-danger p-3 text-sm" role="alert">Este link é inválido, expirou ou já foi utilizado.</p>
              <Button asChild className="w-full"><Link to="/recuperar-senha">Solicitar outro link</Link></Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={reset}>
              <label className="block text-sm font-medium">Nova senha<Input className="mt-2" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              <label className="block text-sm font-medium">Confirmar senha<Input className="mt-2" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
              <label className="flex items-start gap-3 text-sm text-muted-foreground"><input className="mt-1 h-4 w-4" type="checkbox" checked={revokeOthers} onChange={(event) => setRevokeOthers(event.target.checked)} />Encerrar minhas outras sessões.</label>
              {message && <p className="rounded-md bg-status-danger p-3 text-sm" role="alert">{message}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Alterando…' : 'Redefinir senha'}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
