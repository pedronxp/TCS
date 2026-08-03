import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Eye, EyeOff } from 'lucide-react';
import { TcsMark } from '@/components/brand/TcsMark';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { safePortalDestination } from '@/lib/portal';

export function PortalAuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const {
    access, entryContext, session, loading, signIn, signUp, signInWithGoogle,
    bootstrapIndividual, bootstrapMunicipal, signOut,
  } = usePortalAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [accountKind, setAccountKind] = useState<'individual' | 'organization'>('individual');
  const [organizationName, setOrganizationName] = useState('');
  const [municipalityName, setMunicipalityName] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const query = new URLSearchParams(location.search);
  const status = query.get('status');
  const returnTo = query.get('returnTo');
  const inviteReturn = returnTo && /^\/convite\/[a-f0-9]{48}$/i.test(returnTo) ? returnTo : null;

  useEffect(() => {
    if (status === 'sem-acesso') setMessage('Sua conta está autenticada, mas ainda não possui um portal ativo.');
    if (status === 'vinculo-inativo') setMessage('Seu vínculo municipal não está ativo. Fale com a coordenação.');
  }, [status]);

  if (!loading && session && inviteReturn) {
    return <Navigate to={inviteReturn} replace />;
  }
  if (!loading && access && status !== 'vinculo-inativo') {
    return <Navigate to={safePortalDestination(query.get('returnTo'), access.accountKind)} replace />;
  }

  if (!loading && session && access && status === 'vinculo-inativo') {
    return (
      <AuthFrame>
        <Card className="w-full max-w-[460px]">
          <CardHeader>
            <h1 className="min-w-0 text-[22px] font-semibold leading-[1.4]">Vínculo municipal inativo</h1>
            <CardDescription>
              Seu acesso à organização está suspenso ou foi removido. Fale com a coordenação municipal antes de tentar novamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="rounded-md border border-warning/25 bg-status-warning p-4 text-sm text-foreground" role="status">
              Nenhum dado municipal foi carregado para esta sessão.
            </p>
            <Button
              className="w-full"
              onClick={() => void signOut().then(() => navigate('/entrar', { replace: true }))}
            >
              Sair e usar outra conta
            </Button>
            <Button asChild variant="ghost" className="w-full"><Link to="/">Voltar ao site</Link></Button>
          </CardContent>
        </Card>
      </AuthFrame>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const error = mode === 'sign-in'
      ? await signIn(email, password)
      : await signUp(name, email, password, query.get('plan'));
    setSubmitting(false);
    if (error) {
      setMessage(error);
      return;
    }
    if (mode === 'sign-up') {
      setSuccess(true);
      setMessage('Conta criada. Confirme o link enviado ao seu e-mail para continuar.');
      return;
    }
    navigate(`/entrar${location.search}`, { replace: true });
  }

  async function google() {
    setSubmitting(true);
    const error = await signInWithGoogle();
    setSubmitting(false);
    if (error) setMessage(error);
  }

  async function activateCustomer() {
    if (!termsAccepted) return;
    if (accountKind === 'organization' && (
      !organizationName.trim() || !municipalityName.trim()
      || stateCode.trim().length !== 2 || !responsibleName.trim()
    )) {
      setMessage('Preencha organização, município, UF e responsável.');
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const bootstrapError = accountKind === 'individual'
      ? await bootstrapIndividual()
      : await bootstrapMunicipal({
        displayName: organizationName,
        municipalityName,
        stateCode,
        responsibleName,
      });
    setSubmitting(false);
    if (bootstrapError) setMessage(bootstrapError);
  }

  if (!loading && session && !access) {
    return (
      <AuthFrame>
        <Card className="w-full max-w-[620px]">
          <CardHeader>
            <h1 className="min-w-0 text-[22px] font-semibold leading-[1.4]">Configure seu acesso</h1>
            <CardDescription>Sua identidade foi confirmada. Escolha como você utilizará o TCS; o portal complementa a operação do aplicativo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-md bg-secondary p-4 text-sm text-muted-foreground">
              {lifecycleMessage(entryContext?.lifecycleState)} Se você recebeu convite municipal, abra novamente o link recebido.
            </p>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de cliente">
              <button
                type="button"
                role="radio"
                aria-checked={accountKind === 'individual'}
                disabled={entryContext?.individualBootstrapEnabled === false}
                onClick={() => setAccountKind('individual')}
                className={`rounded-md border p-4 text-left transition ${accountKind === 'individual' ? 'border-primary bg-secondary' : 'border-border'} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="block font-semibold">Profissional individual</span>
                <span className="mt-1 block text-xs text-muted-foreground">Trial individual, sem criar prefeitura.</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={accountKind === 'organization'}
                disabled={entryContext?.municipalBootstrapEnabled === false}
                onClick={() => setAccountKind('organization')}
                className={`rounded-md border p-4 text-left transition ${accountKind === 'organization' ? 'border-primary bg-secondary' : 'border-border'} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="block font-semibold">Prefeitura ou município</span>
                <span className="mt-1 block text-xs text-muted-foreground">Cria implantação provisória e o primeiro administrador.</span>
              </button>
            </div>
            {accountKind === 'organization' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">Nome da organização<Input className="mt-2" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required /></label>
                <label className="text-sm font-medium">Município<Input className="mt-2" value={municipalityName} onChange={(event) => setMunicipalityName(event.target.value)} required /></label>
                <label className="text-sm font-medium">UF<Input className="mt-2" value={stateCode} maxLength={2} onChange={(event) => setStateCode(event.target.value.toUpperCase())} required /></label>
                <label className="text-sm font-medium">Responsável<Input className="mt-2" value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} required /></label>
              </div>
            )}
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              Aceito os termos de uso e privacidade (customer-terms-2026-08).
            </label>
            {message && <p className="rounded-md border border-destructive/20 bg-status-danger p-3 text-sm" role="alert">{message}</p>}
            <Button
              className="w-full"
              disabled={!termsAccepted || submitting || (
                accountKind === 'individual'
                  ? entryContext?.individualBootstrapEnabled === false
                  : entryContext?.municipalBootstrapEnabled === false
              )}
              onClick={() => void activateCustomer()}
            >
              {submitting ? 'Preparando…' : accountKind === 'individual' ? 'Iniciar acesso individual' : 'Iniciar implantação municipal'}
            </Button>
            <Button asChild variant="outline" className="w-full"><Link to="/#planos">Ver planos</Link></Button>
          </CardContent>
        </Card>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <Card className="w-full max-w-[460px]">
        <CardHeader>
          <h1 className="min-w-0 text-[22px] font-semibold leading-[1.4]">
            {mode === 'sign-in' ? 'Entrar no portal' : 'Criar conta'}
          </h1>
          <CardDescription>
            {mode === 'sign-in'
              ? 'Use sua conta individual ou o e-mail do vínculo municipal.'
              : 'Comece com uma identidade segura. O plano é escolhido depois da confirmação.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            {mode === 'sign-up' && (
              <label className="block text-sm font-medium">
                Nome completo
                <Input className="mt-2" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} required />
              </label>
            )}
            <label className="block text-sm font-medium">
              E-mail
              <Input className="mt-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="block text-sm font-medium">
              Senha
              <span className="relative mt-2 block">
                <Input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
                <button type="button" className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
            {message && (
              <div
                className={`rounded-md border p-3 text-sm text-foreground ${success ? 'border-success/25 bg-status-success' : 'border-destructive/20 bg-status-danger'}`}
                role={success ? 'status' : 'alert'}
              >
                {message}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting || success}>
              {submitting ? 'Aguarde…' : mode === 'sign-in' ? 'Entrar' : 'Criar conta'}
            </Button>
            {mode === 'sign-in' && <Link className="block text-center text-sm font-semibold text-primary hover:underline" to="/recuperar-senha">Esqueci minha senha</Link>}
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
          <Button variant="outline" className="w-full" onClick={() => void google()} disabled={submitting}>
            Continuar com Google
          </Button>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === 'sign-in' ? 'Ainda não tem uma conta? ' : 'Já possui uma conta? '}
            <Link className="font-semibold text-primary hover:underline" to={mode === 'sign-in' ? '/criar-conta' : '/entrar'}>
              {mode === 'sign-in' ? 'Criar conta' : 'Entrar'}
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}

function lifecycleMessage(state?: string) {
  const messages: Record<string, string> = {
    creating: 'Finalize os dados iniciais para criar seu acesso.',
    under_review: 'Seu cadastro está em análise e pode ser retomado aqui.',
    trial: 'Seu período de avaliação está ativo; a contratação definitiva é uma etapa separada.',
    contracting_pending: 'A operação aguarda formalização comercial.',
    active: 'Seu cliente está ativo.',
    blocked: 'O cadastro está bloqueado para novas alterações.',
  };
  return messages[state ?? 'creating'] ?? messages.creating;
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(460px,0.72fr)]">
      <a
        href="#auth-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
      <aside aria-label="Apresentação do portal TCS" className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col">
        <Link to="/" className="flex items-center gap-3"><TcsMark decorative /><span className="font-bold">TCS</span></Link>
        <div className="my-auto max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-warm">Operação em um só lugar</p>
          <p className="mt-5 text-4xl font-semibold leading-tight">Do território à decisão, com acesso seguro para cada papel.</p>
          <ul className="mt-8 space-y-4 text-sm text-white/65">
            {['Vistorias, agenda e documentos conectados', 'Visão individual ou municipal conforme seu vínculo', 'Plano, permissões e consumo sempre transparentes'].map((item) => (
              <li key={item} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-white/10"><Check className="h-3.5 w-3.5 text-warm" /></span>{item}</li>
            ))}
          </ul>
        </div>
      </aside>
      <main id="auth-content" tabIndex={-1} className="flex min-h-screen flex-col p-4 sm:p-8">
        <div><Button asChild variant="ghost"><Link to="/"><ArrowLeft /> Voltar ao site</Link></Button></div>
        <div className="flex flex-1 items-center justify-center py-8">{children}</div>
      </main>
    </div>
  );
}
