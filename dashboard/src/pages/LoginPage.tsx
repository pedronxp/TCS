import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { GoogleMark } from '@/components/brand/GoogleMark';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { AuthFrame, AuthLoadingCard } from '@/components/auth/AuthFrame';
import { TurnstileChallenge, turnstileEnabled } from '@/components/auth/TurnstileChallenge';
import { useAuth } from '@/contexts/AuthContext';
import { safeConsoleDestination } from '@/lib/routes';
import { supabaseConfigurationAvailable } from '@/lib/supabase';

const consoleAside = {
  asideLabel: 'Console interno TCS',
  asideHeadline: 'A operação da TCS, em um ambiente reservado.',
  asideDescription: 'Acesse clientes, suporte, assinaturas e saúde técnica com as permissões da sua função.',
  asideBullets: ['Acesso conforme papel e permissões', 'Autenticação e sessão protegidas', 'Retorno automático à rota solicitada'],
  asideFooter: 'Sessão protegida e acesso conforme sua função',
} as const;

interface LoginLocationState {
  from?: { pathname?: string; search?: string; hash?: string };
}

export function LoginPage() {
  const { session, signIn, signInWithGoogle, isAuthorized, loading: authLoading, authMessage } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRevision, setCaptchaRevision] = useState(0);
  const requested = (location.state as LoginLocationState | null)?.from;
  const requestedPath = `${requested?.pathname || ''}${requested?.search || ''}${requested?.hash || ''}`;
  const destination = safeConsoleDestination(requestedPath);

  if (authLoading) {
    return <AuthLoadingCard label="Verificando sessão" hint="Confirmamos se sua sessão interna ainda está ativa." />;
  }

  // Cliente autenticado que caiu em /login por engano: encaminhe ao portal
  // em vez de mostrar um beco sem saída com visual divergente.
  if (session && !isAuthorized) {
    const search = new URLSearchParams({ source: 'console' });
    if (requestedPath) search.set('returnTo', requestedPath);
    return <Navigate to={`/auth/callback?${search.toString()}`} replace />;
  }

  if (isAuthorized) return <Navigate to={destination} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!supabaseConfigurationAvailable) {
      setError('O acesso está temporariamente indisponível porque a autenticação não foi configurada.');
      return;
    }

    if (turnstileEnabled && !captchaToken) {
      setError('Conclua a verificação de segurança antes de continuar.');
      return;
    }

    setSubmitting(true);
    const result = captchaToken
      ? await signIn(email.trim(), password, captchaToken)
      : await signIn(email.trim(), password);
    if (result.error) {
      setError(result.error);
      setCaptchaToken(null);
      setCaptchaRevision((value) => value + 1);
    } else {
      const callback = new URLSearchParams({ source: 'console' });
      if (requestedPath) callback.set('returnTo', requestedPath);
      navigate(`/auth/callback?${callback.toString()}`, { replace: true });
    }
    setSubmitting(false);
  }

  async function handleGoogle() {
    setError(null);
    if (!supabaseConfigurationAvailable) {
      setError('O acesso está temporariamente indisponível porque a autenticação não foi configurada.');
      return;
    }
    setGoogleSubmitting(true);
    const result = await signInWithGoogle();
    if (result.error) setError(result.error);
    setGoogleSubmitting(false);
  }

  return (
    <AuthFrame {...consoleAside}>
      <div className="w-full max-w-[460px]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Console TCS</p>
          <h1 className="mt-2 text-[28px] font-semibold leading-[1.3] tracking-[-0.02em]">Entre no Console</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Use seu e-mail corporativo. Você voltará ao ponto em que estava.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10" aria-busy={submitting}>
          {!supabaseConfigurationAvailable && (
            <Alert variant="destructive" className="mb-5">
              <AlertTitle>Autenticação indisponível</AlertTitle>
              <AlertDescription>
                A configuração pública do Supabase não foi carregada. Reinicie o dashboard com <code>npm run dev</code>.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="internal-email">E-mail</Label>
            <Input
              id="internal-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting || !supabaseConfigurationAvailable}
              placeholder="nome@empresa.com.br"
              className="h-12 bg-background"
            />
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="internal-password">Senha</Label>
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                {showPassword ? 'Ocultar' : 'Exibir'}
              </button>
            </div>
            <Input
              id="internal-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting || !supabaseConfigurationAvailable}
              className="h-12 bg-background"
            />
          </div>

          <div className="mt-7 flex justify-end">
            <a
              href="mailto:suporte@tcs.app?subject=Recuperação%20de%20acesso"
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Esqueci minha senha
            </a>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-5" role="alert">
              <AlertTitle>Não foi possível entrar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {authMessage && !error && (
            <Alert className="mt-5" role="status">
              <AlertTitle>Atenção ao acesso</AlertTitle>
              <AlertDescription>{authMessage}</AlertDescription>
            </Alert>
          )}

          {turnstileEnabled && (
            <div className="mt-6">
              <TurnstileChallenge key={captchaRevision} onToken={setCaptchaToken} />
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || !supabaseConfigurationAvailable || (turnstileEnabled && !captchaToken)}
            className="mt-8 h-[46px] w-full"
          >
            {submitting && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {submitting ? 'Entrando…' : 'Entrar na TCS Console'}
          </Button>
        </form>

        <div className="my-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Ou continue com</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-[46px] w-full"
          disabled={googleSubmitting || !supabaseConfigurationAvailable}
          onClick={() => void handleGoogle()}
        >
          {googleSubmitting ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <GoogleMark />}
          {googleSubmitting ? 'Abrindo Google…' : 'Entrar ou criar conta com Google'}
        </Button>
        <p className="mt-7 text-center text-[12px] leading-5 text-muted-foreground">
          Primeiro acesso com Google? A equipe TCS revisará a conta antes de liberar o Console. Permissões existentes não mudam.
        </p>

        <div className="mt-8 rounded-md border border-border bg-secondary/40 p-4 text-center">
          <p className="text-[12px] leading-5 text-muted-foreground">
            Não faz parte da equipe interna TCS?
          </p>
          <Link
            to="/entrar"
            className="mt-1.5 inline-block text-[13px] font-semibold text-primary hover:underline"
          >
            Entrar no Portal TCS →
          </Link>
          <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
            O Console é reservado a administradores. Contas de clientes e municípios acessam pelo Portal.
          </p>
        </div>
      </div>
    </AuthFrame>
  );
}
