import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { TcsMark } from '@/components/brand/TcsMark';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  resolveAuthenticatedAccountEntry,
  resolveAuthCallbackSession,
} from '@/lib/account-entry';

const steps = [
  'Confirmar a autenticação segura',
  'Identificar seu perfil e seus vínculos',
  'Abrir o ambiente correto',
] as const;

const PROFILE_STEP_MINIMUM_MS = 450;
const CALLBACK_MINIMUM_MS = 1800;

function waitUntilVisibleSince(startedAt: number, minimumDuration: number) {
  const remaining = minimumDuration - (Date.now() - startedAt);
  if (remaining <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, remaining);
  });
}

export function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [destinationLabel, setDestinationLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = new URLSearchParams(location.search);
  const source = search.get('source');
  const googleAuthentication = search.get('provider') === 'google';
  const fallback = source === 'console' ? '/login' : '/entrar';

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();

    async function completeAuthentication() {
      try {
        const session = await resolveAuthCallbackSession(window.location.href);
        if (!active) return;
        await waitUntilVisibleSince(startedAt, PROFILE_STEP_MINIMUM_MS);
        if (!active) return;
        setCurrentStep(1);

        const returnTo = new URLSearchParams(window.location.search).get('returnTo');
        const entry = await resolveAuthenticatedAccountEntry(session.user, returnTo);
        if (!active) return;

        setDestinationLabel(entry.label);
        setCurrentStep(2);
        await waitUntilVisibleSince(startedAt, CALLBACK_MINIMUM_MS);
        if (!active) return;
        window.history.replaceState({}, '', '/auth/callback');
        navigate(entry.destination, { replace: true });
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error
          ? cause.message
          : 'Não foi possível identificar seu acesso. Tente novamente.');
      }
    }

    void completeAuthentication();
    return () => { active = false; };
  }, [location.key, navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <Card className="w-full max-w-[520px] overflow-hidden">
        <CardContent className="px-6 py-9 sm:px-10 sm:py-11">
          <div className="flex items-center justify-center gap-3">
            <TcsMark decorative />
            <span className="text-sm font-semibold tracking-[0.16em]">TCS</span>
          </div>

          <div className="mt-8 text-center" aria-live="polite">
            {error ? (
              <AlertCircle className="mx-auto h-9 w-9 text-destructive" aria-hidden="true" />
            ) : (
              <Loader2 className="mx-auto h-9 w-9 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            )}
            <h1 className="mt-5 text-[24px] font-semibold leading-tight tracking-[-0.02em]">
              {error
                ? 'Não foi possível concluir o acesso'
                : googleAuthentication
                  ? 'Conectando ao Google'
                  : 'Autenticando sua conta TCS'}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {error || (destinationLabel
                ? `Preparando ${destinationLabel.toLowerCase()} para você.`
                : googleAuthentication
                  ? 'Validando sua conta Google e identificando o ambiente correto.'
                  : 'Estamos validando sua sessão e identificando o ambiente correto.')}
            </p>
          </div>

          {!error && (
            <ol className="mt-8 space-y-4 rounded-lg border border-border bg-secondary/30 p-5" role="status">
              {steps.map((step, index) => {
                const label = googleAuthentication && index === 0
                  ? 'Confirmar a autorização da conta Google'
                  : step;
                const completed = index < currentStep;
                const running = index === currentStep;
                return (
                  <li key={step} className="flex items-center gap-3 text-sm">
                    {completed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    ) : running ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      <span className="h-4 w-4 shrink-0 rounded-full border border-border" aria-hidden="true" />
                    )}
                    <span className={running || completed ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {error && (
            <div className="mt-8 space-y-3">
              <Button asChild className="w-full"><Link to={fallback}>Voltar e tentar novamente</Link></Button>
              <Button asChild variant="ghost" className="w-full"><Link to="/">Voltar ao site</Link></Button>
            </div>
          )}

          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Seu acesso é validado conforme seu perfil e suas permissões.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
