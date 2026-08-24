import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TcsMark } from '@/components/brand/TcsMark';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TurnstileChallenge, turnstileEnabled } from '@/components/auth/TurnstileChallenge';
import { supabase } from '@/lib/supabase';

const RECOVERY_MARKER = 'tcs.portal.password-recovery';

export function PortalPasswordRecoveryPage({ mode }: { mode: 'request' | 'reset' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [validRecovery, setValidRecovery] = useState<boolean | null>(mode === 'request' ? true : null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRevision, setCaptchaRevision] = useState(0);
  const loginPath = `/entrar${location.search}`;
  const requestPath = `/recuperar-senha${location.search}`;

  useEffect(() => {
    if (mode !== 'reset') return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15; // 15 * 200ms = 3s
    const verify = async (): Promise<boolean | null> => {
      const { data } = await supabase.auth.getSession();
      const raw = window.sessionStorage.getItem(RECOVERY_MARKER);
      // Session e marker ambos ausentes — recovery ainda em load, aguarda
      if (!data.session && !raw) return null;
      if (!data.session || !raw) return false;
      try {
        const marker = JSON.parse(raw) as { userId: string; expiresAt: number };
        return marker.userId === data.session.user.id && marker.expiresAt > Date.now();
      } catch {
        return false;
      }
    };
    const interval = window.setInterval(() => {
      attempts++;
      void verify().then((valid) => {
        if (cancelled) return;
        if (valid !== null || attempts >= maxAttempts) {
          window.clearInterval(interval);
          setValidRecovery(valid ?? false);
        }
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mode]);

  async function request(event: FormEvent) {
    event.preventDefault();
    if (turnstileEnabled && !captchaToken) {
      setMessage('Conclua a verificação de segurança antes de continuar.');
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    const flags = await supabase.rpc('get_public_auth_capabilities');
    const publicFlags = flags.data as { password_recovery?: boolean } | null;
    if (flags.error || publicFlags?.password_recovery !== true) {
      setSubmitting(false);
      setMessage('A recuperação de senha está temporariamente indisponível.');
      return;
    }
    const recovery = await supabase.functions.invoke('password-recovery-request', {
      body: {
        email: normalizedEmail,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    if (recovery.error) {
      const status = (recovery.error as { context?: Response }).context?.status;
      setSubmitting(false);
      setCaptchaToken(null);
      setCaptchaRevision((value) => value + 1);
      if (status === 429) {
        setMessage('Muitas tentativas de recuperação. Aguarde alguns minutos e tente novamente.');
        return;
      }
      setMessage('Não foi possível enviar a solicitação agora. Tente novamente em instantes.');
      return;
    }
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
    navigate(loginPath, { replace: true });
  }

  const isRequest = mode === 'request';

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,0.8fr)_minmax(460px,1fr)]">
      <aside className="hidden border-r border-border bg-secondary/50 p-12 lg:flex lg:flex-col" aria-label="Segurança da recuperação de senha">
        <Link to="/" className="flex items-center gap-3 font-bold"><TcsMark decorative />TCS</Link>
        <div className="my-auto max-w-md">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-primary">Recuperação protegida</p>
          <p className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.02em]">Recupere o acesso sem expor sua conta.</p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            O portal valida o link e a sessão antes de aceitar uma nova senha.
          </p>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">Por segurança, respostas de recuperação não confirmam se um e-mail está cadastrado.</p>
      </aside>

      <section className="flex min-h-screen flex-col p-4 sm:p-8">
        <div>
          <Button asChild variant="ghost"><Link to={loginPath}><ArrowLeft aria-hidden="true" /> Voltar ao login</Link></Button>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <Card className="w-full max-w-[460px]">
            <CardHeader>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                {isRequest ? 'Recuperar acesso' : 'Link de recuperação'}
              </p>
              <h1 className="text-[28px] font-semibold leading-[1.3] tracking-[-0.02em]">
                {isRequest ? 'Receba um link seguro' : 'Crie uma nova senha'}
              </h1>
              <CardDescription>
                {isRequest
                  ? 'Informe o e-mail da sua conta. O link será enviado se o acesso estiver elegível.'
                  : 'Use pelo menos 8 caracteres. A alteração só funciona nesta sessão de recuperação.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sent ? (
                <RecoverySent loginPath={loginPath} />
              ) : isRequest ? (
                <form className="space-y-4" onSubmit={request} aria-busy={submitting}>
                  <label className="block text-sm font-medium">
                    E-mail
                    <Input className="mt-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                  </label>
                  {message && <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-foreground" role="alert">{message}</p>}
                  {turnstileEnabled && <TurnstileChallenge key={captchaRevision} onToken={setCaptchaToken} />}
                  <Button type="submit" className="w-full" disabled={submitting || (turnstileEnabled && !captchaToken)}>
                    {submitting && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    {submitting ? 'Enviando…' : 'Enviar link seguro'}
                  </Button>
                  <p className="text-center text-xs leading-5 text-muted-foreground">O link expira e só pode ser usado em uma sessão válida.</p>
                </form>
              ) : validRecovery === null ? (
                <div className="flex items-center gap-3 rounded-md bg-secondary p-4 text-sm text-muted-foreground" role="status">
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Validando sua sessão de recuperação…
                </div>
              ) : !validRecovery ? (
                <div className="space-y-4">
                  <p className="rounded-md border border-warning/30 bg-warning-soft p-4 text-sm text-foreground" role="alert">Este link é inválido, expirou ou já foi utilizado.</p>
                  <Button asChild className="w-full"><Link to={requestPath}>Solicitar outro link</Link></Button>
                  <Button asChild variant="ghost" className="w-full"><Link to={loginPath}>Voltar ao login</Link></Button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={reset} aria-busy={submitting}>
                  <PasswordField label="Nova senha" value={password} show={showPasswords} onChange={setPassword} />
                  <PasswordField label="Confirmar senha" value={confirmation} show={showPasswords} onChange={setConfirmation} />
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setShowPasswords((value) => !value)}
                    aria-label={showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    {showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
                  </button>
                  <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm text-muted-foreground">
                    <input className="mt-1 h-4 w-4" type="checkbox" checked={revokeOthers} onChange={(event) => setRevokeOthers(event.target.checked)} />
                    <span><span className="block font-medium text-foreground">Encerrar outras sessões</span>Recomendado se você não reconhece o motivo da troca.</span>
                  </label>
                  {message && <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-foreground" role="alert">{message}</p>}
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    {submitting ? 'Alterando…' : 'Salvar nova senha'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function PasswordField({ label, value, show, onChange }: { label: string; value: string; show: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <Input className="mt-2" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}

function RecoverySent({ loginPath }: { loginPath: string }) {
  return (
    <div className="space-y-5" role="status">
      <div className="flex gap-3 rounded-md border border-primary/25 bg-success-soft p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="font-semibold text-foreground">Verifique seu e-mail</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Se existir uma conta elegível, o link será enviado para o endereço informado.</p>
        </div>
      </div>
      <div className="flex gap-3 text-sm leading-6 text-muted-foreground">
        <Mail className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
        Confira também a caixa de spam. O envio pode levar alguns minutos.
      </div>
      <Button asChild className="w-full"><Link to={loginPath}>Voltar ao login</Link></Button>
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" />Não compartilhe o link recebido.</p>
    </div>
  );
}
