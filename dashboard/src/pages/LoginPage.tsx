import { useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { TcsMark } from '@/components/brand/TcsMark';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useAuth } from '@/contexts/AuthContext';
import { safeConsoleDestination } from '@/lib/routes';
import { supabaseConfigurationAvailable } from '@/lib/supabase';

interface LoginLocationState {
  from?: { pathname?: string; search?: string; hash?: string };
}

export function LoginPage() {
  const { signIn, signInWithGoogle, isAuthorized, loading: authLoading, authMessage } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const requested = (location.state as LoginLocationState | null)?.from;
  const requestedPath = `${requested?.pathname || ''}${requested?.search || ''}${requested?.hash || ''}`;
  const destination = safeConsoleDestination(requestedPath);

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground" aria-live="polite">
        <Loader2 className="h-7 w-7 animate-spin" />
        <span className="sr-only">Verificando sessão…</span>
      </div>
    );
  }

  if (isAuthorized) return <Navigate to={destination} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!supabaseConfigurationAvailable) {
      setError('O acesso está temporariamente indisponível porque a autenticação não foi configurada.');
      return;
    }

    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    if (result.error) setError(result.error);
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
    <main className="min-h-screen bg-card lg:grid lg:grid-cols-[minmax(0,1.1176fr)_minmax(0,1fr)]">
      <section className="flex min-h-[330px] flex-col bg-foreground px-6 py-8 text-background sm:min-h-[390px] sm:px-10 lg:min-h-screen lg:px-10 lg:py-12 xl:px-14">
        <Link to="/" className="flex w-fit items-center gap-3 text-[15px] font-semibold">
          <TcsMark decorative />
          TCS Console
        </Link>

        <div className="mt-14 max-w-[610px] lg:mt-[74px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Operação conectada</p>
          <h1 className="mt-5 text-[32px] font-bold leading-[1.2] tracking-[-0.025em] sm:text-[38px] xl:text-[42px]">
            Decisões melhores começam com dados confiáveis.
          </h1>
          <p className="mt-6 max-w-[560px] text-[15px] leading-6 text-background/60 sm:text-base">
            Entre para acompanhar clientes, suporte, assinaturas e a saúde técnica da plataforma em um único lugar.
          </p>
        </div>

        <div className="mt-10 hidden max-w-[648px] rounded-lg border border-background/10 bg-background/5 p-6 md:block lg:mt-[52px] xl:p-8">
          <blockquote className="max-w-[560px] text-[17px] font-medium leading-7 text-background/85">
            “A operação ficou mais previsível quando todos passaram a enxergar a mesma informação.”
          </blockquote>
          <div className="my-6 h-px bg-background/10" />
          <dl className="grid grid-cols-3 gap-4">
            <LoginMetric label="Clientes ativos" value="148" />
            <LoginMetric label="SLA cumprido" value="96,8%" />
            <LoginMetric label="Versão publicada" value="2.17.0" />
          </dl>
        </div>

        <p className="mt-auto hidden pt-8 text-[11px] text-background/40 lg:block">
          Conexão segura · Acesso auditado · LGPD
        </p>
      </section>

      <section className="bg-card px-5 py-10 sm:px-10 lg:min-h-screen lg:px-8 lg:py-12 xl:px-14">
        <div className="mx-auto w-full max-w-[496px]">
          <Link to="/" className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao site
          </Link>

          <div className="mt-[92px] lg:mt-[102px]">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Área restrita</p>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.2] tracking-[-0.02em]">Bem-vindo de volta</h2>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Use suas credenciais corporativas para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-[56px]">
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
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Checkbox
                  checked={rememberDevice}
                  onCheckedChange={(checked) => setRememberDevice(checked === true)}
                />
                Manter sessão neste dispositivo
              </label>
              <a
                href="mailto:suporte@tcs.app?subject=Recuperação%20de%20acesso"
                className="text-[13px] font-medium text-primary hover:underline"
              >
                Esqueci minha senha
              </a>
            </div>

            {error && (
              <Alert variant="destructive" className="mt-5">
                <AlertTitle>Não foi possível entrar</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {authMessage && !error && (
              <Alert className="mt-5">
                <AlertTitle>Conta protegida</AlertTitle>
                <AlertDescription>{authMessage}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={submitting || !supabaseConfigurationAvailable}
              className="mt-8 h-[46px] w-full"
            >
              {submitting && <Loader2 className="animate-spin" />}
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
            {googleSubmitting ? <Loader2 className="animate-spin" /> : <GoogleMark />}
            {googleSubmitting ? 'Abrindo Google…' : 'Entrar ou criar conta com Google'}
          </Button>
          <p className="mt-7 text-center text-[12px] leading-5 text-muted-foreground">
            Contas novas ficam pendentes até a aprovação da equipe TCS. Contas existentes mantêm as permissões atuais.
          </p>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1A10 10 0 0 0 2 12c0 1.7.4 3.2 1.1 4.6L6.5 14Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 5.9Z" />
    </svg>
  );
}

function LoginMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-background/40">{label}</dt>
      <dd className="mt-2 text-[21px] font-semibold text-background">{value}</dd>
    </div>
  );
}
