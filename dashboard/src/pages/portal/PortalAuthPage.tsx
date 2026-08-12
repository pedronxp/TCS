import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { GoogleMark } from '@/components/brand/GoogleMark';
import { AuthFrame, AuthLoadingCard } from '@/components/auth/AuthFrame';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { safePortalDestination } from '@/lib/portal';


const portalAside = {
  asideLabel: 'Portal TCS',
  asideHeadline: 'Seu trabalho de campo continua no portal.',
  asideDescription: 'Entre no ambiente certo para acompanhar vistorias, documentos e operação conforme o seu vínculo.',
  asideBullets: ['Acesso individual ou municipal', 'Permissões aplicadas ao seu vínculo', 'Continuidade da rota que você solicitou'],
} as const;
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
  const [accountSwitchError, setAccountSwitchError] = useState<string | null>(null);
  const [switchingAccount, setSwitchingAccount] = useState(false);
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

  async function handleUseAnotherAccount() {
    setSwitchingAccount(true);
    setAccountSwitchError(null);
    try {
      await signOut();
      navigate('/entrar', { replace: true });
    } catch {
      setAccountSwitchError('Não foi possível sair. Esta sessão continua aberta; tente novamente.');
      setSwitchingAccount(false);
    }
  }

  if (loading) {
    return <AuthLoadingCard />;
  }

  if (!loading && session && (
    entryContext?.accountKind === 'internal'
    || (!access && !entryContext)
  )) {
    return <Navigate to="/login" replace />;
  }
  if (!loading && session && inviteReturn) {
    return <Navigate to={inviteReturn} replace />;
  }
  if (!loading && access && status !== 'vinculo-inativo') {
    return <Navigate to={safePortalDestination(query.get('returnTo'), access.accountKind)} replace />;
  }

  if (!loading && session && access && status === 'vinculo-inativo') {
    return (
      <AuthFrame {...portalAside}>
        <Card className="w-full max-w-[460px]">
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">Acesso suspenso</p>
            <h1 className="min-w-0 text-[24px] font-semibold leading-[1.3]">Vínculo municipal inativo</h1>
            <CardDescription>
              Seu acesso à organização está suspenso ou foi removido. Fale com a coordenação municipal antes de tentar novamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="rounded-md border border-warning/30 bg-warning-soft p-4 text-sm text-foreground" role="alert">
              Nenhum dado municipal foi carregado para esta sessão.
            </p>
            {accountSwitchError && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{accountSwitchError}</p>}
            <Button className="w-full" disabled={switchingAccount} onClick={() => void handleUseAnotherAccount()}>
              {switchingAccount ? 'Saindo…' : 'Sair e usar outra conta'}
            </Button>
            <Button asChild variant="ghost" className="w-full"><Link to="/">Voltar ao site</Link></Button>
          </CardContent>
        </Card>
      </AuthFrame>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === 'sign-up' && !termsAccepted) {
      setMessage('Aceite os Termos de Uso e a Política de Privacidade para criar sua conta.');
      return;
    }
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
    if (mode === 'sign-up' && !termsAccepted) {
      setMessage('Aceite os Termos de Uso e a Política de Privacidade antes de continuar com o Google.');
      return;
    }
    setSubmitting(true);
    setMessage(null);
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
      <AuthFrame {...portalAside}>
        <Card className="w-full max-w-[620px]">
          <CardHeader>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Etapa 2 de 2</p>
            <h1 className="min-w-0 text-[26px] font-semibold leading-[1.3]">Defina como você usará a TCS</h1>
            <CardDescription>Sua identidade já foi confirmada. Agora escolha o tipo de acesso para abrir o onboarding correto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-md border border-border bg-secondary p-4 text-sm text-muted-foreground" role="status">
              {lifecycleMessage(entryContext?.lifecycleState)} Se você recebeu convite municipal, abra novamente o link recebido.
            </p>
            <fieldset className="grid gap-3 border-0 p-0 sm:grid-cols-2">
              <legend className="sr-only">Tipo de cliente</legend>
              <AccountKindOption
                value="individual"
                checked={accountKind === 'individual'}
                disabled={entryContext?.individualBootstrapEnabled === false}
                title="Profissional individual"
                description="Acesso de avaliação para uso em nome próprio."
                onChange={setAccountKind}
              />
              <AccountKindOption
                value="organization"
                checked={accountKind === 'organization'}
                disabled={entryContext?.municipalBootstrapEnabled === false}
                title="Prefeitura ou município"
                description="Inicia uma implantação provisória com o primeiro administrador."
                onChange={setAccountKind}
              />
            </fieldset>
            {accountKind === 'organization' && (
              <fieldset className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2">
                <legend className="px-1 text-sm font-semibold">Dados iniciais da implantação</legend>
                <label className="text-sm font-medium">Nome da organização<Input className="mt-2" autoComplete="organization" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required /></label>
                <label className="text-sm font-medium">Município<Input className="mt-2" value={municipalityName} onChange={(event) => setMunicipalityName(event.target.value)} required /></label>
                <label className="text-sm font-medium">UF<Input className="mt-2 uppercase" value={stateCode} maxLength={2} onChange={(event) => setStateCode(event.target.value.toUpperCase())} required /></label>
                <label className="text-sm font-medium">Responsável<Input className="mt-2" autoComplete="name" value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} required /></label>
              </fieldset>
            )}
            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              Aceito os Termos de Uso e a Política de Privacidade vigentes.
            </label>
            {message && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{message}</p>}
            {accountSwitchError && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{accountSwitchError}</p>}
            <Button
              className="w-full"
              aria-busy={submitting}
              disabled={!termsAccepted || submitting || (
                accountKind === 'individual'
                  ? entryContext?.individualBootstrapEnabled === false
                  : entryContext?.municipalBootstrapEnabled === false
              )}
              onClick={() => void activateCustomer()}
            >
              {submitting && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {submitting ? 'Preparando…' : accountKind === 'individual' ? 'Continuar com acesso individual' : 'Continuar com implantação municipal'}
            </Button>
            <p className="text-center text-xs leading-5 text-muted-foreground">Você poderá consultar os planos antes da contratação definitiva.</p>
            <Button asChild variant="outline" className="w-full"><Link to="/#planos">Consultar planos</Link></Button>
            <Button type="button" variant="ghost" className="w-full" disabled={submitting || switchingAccount} onClick={() => void handleUseAnotherAccount()}>
              {switchingAccount ? 'Saindo…' : 'Sair e usar outra conta'}
            </Button>
          </CardContent>
        </Card>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame {...portalAside}>
      <Card className="w-full max-w-[460px]">
        <CardHeader>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            {mode === 'sign-in' ? 'Portal TCS' : 'Etapa 1 de 2'}
          </p>
          <h1 className="min-w-0 text-[28px] font-semibold leading-[1.3] tracking-[-0.02em]">
            {mode === 'sign-in' ? 'Acesse seu portal' : 'Crie seu acesso'}
          </h1>
          <CardDescription>
            {mode === 'sign-in'
              ? 'Entre com sua conta individual ou com o e-mail do seu vínculo municipal.'
              : 'Informe seus dados de acesso. Depois de confirmar o e-mail, você escolherá o tipo de uso.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-5" role="status">
              <div className="flex gap-3 rounded-md border border-primary/25 bg-success-soft p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-foreground">Confirme seu e-mail</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{message}</p>
                </div>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Abra a mensagem da TCS no mesmo dispositivo. Se não aparecer, confira a caixa de spam antes de tentar novamente.
              </p>
              <Button asChild className="w-full"><Link to={`/entrar${location.search}`}>Ir para o login</Link></Button>
            </div>
          ) : (
            <>
              <form className="space-y-4" onSubmit={submit} aria-busy={submitting}>
                {mode === 'sign-up' && (
                  <label className="block text-sm font-medium" htmlFor="portal-name">
                    Nome completo
                    <Input id="portal-name" className="mt-2" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} required />
                  </label>
                )}
                <label className="block text-sm font-medium" htmlFor="portal-email">
                  E-mail
                  <Input id="portal-email" className="mt-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </label>
                <div>
                  <label className="block text-sm font-medium" htmlFor="portal-password">Senha</label>
                  <span className="relative mt-2 block">
                    <Input id="portal-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
                    <button type="button" className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </span>
                  {mode === 'sign-up' && <span className="mt-2 block text-xs font-normal text-muted-foreground">Use pelo menos 8 caracteres.</span>}
                </div>
                {message && <div className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{message}</div>}
                {mode === 'sign-up' && (
                  <label className="flex items-start gap-3 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={termsAccepted}
                      onChange={(event) => setTermsAccepted(event.target.checked)}
                    />
                    Li e aceito os Termos de Uso e a Política de Privacidade vigentes.
                  </label>
                )}
                <Button type="submit" className="w-full" disabled={submitting || (mode === 'sign-up' && !termsAccepted)}>
                  {submitting && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  {submitting ? 'Aguarde…' : mode === 'sign-in' ? 'Entrar no portal' : 'Criar conta'}
                </Button>
                {mode === 'sign-in' && <Link className="block text-center text-sm font-semibold text-primary hover:underline" to={`/recuperar-senha${location.search}`}>Esqueci minha senha</Link>}
              </form>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
              <Button variant="outline" className="w-full" onClick={() => void google()} disabled={submitting || (mode === 'sign-up' && !termsAccepted)} aria-busy={submitting}>
                <GoogleMark />
                Continuar com Google
              </Button>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === 'sign-in' ? 'Ainda não tem uma conta? ' : 'Já possui uma conta? '}
                <Link className="font-semibold text-primary hover:underline" to={`${mode === 'sign-in' ? '/criar-conta' : '/entrar'}${location.search}`}>
                  {mode === 'sign-in' ? 'Criar conta' : 'Entrar'}
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </AuthFrame>
  );
}

function AccountKindOption({
  value,
  checked,
  disabled,
  title,
  description,
  onChange,
}: {
  value: 'individual' | 'organization';
  checked: boolean;
  disabled: boolean;
  title: string;
  description: string;
  onChange: (value: 'individual' | 'organization') => void;
}) {
  return (
    <label
      className={`rounded-md border p-4 text-left outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${checked ? 'border-primary bg-secondary' : 'border-border'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <input
        type="radio"
        name="account-kind"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span className="flex items-center justify-between gap-3 font-semibold">
        {title}
        {checked && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
      </span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
    </label>
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