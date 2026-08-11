import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { TcsMark } from '@/components/brand/TcsMark';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

interface AuthFrameProps {
  asideLabel?: string;
  asideHeadline: string;
  asideDescription: string;
  asideBullets: readonly string[];
  asideFooter?: string;
  backLabel?: string;
  children: ReactNode;
}

export function AuthFrame({
  asideLabel,
  asideHeadline,
  asideDescription,
  asideBullets,
  asideFooter = 'Sessão protegida e acesso conforme seu papel',
  backLabel = 'Voltar ao site',
  children,
}: AuthFrameProps) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(460px,0.72fr)]">
      <a
        href="#auth-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>

      <aside
        aria-label="Apresentação de acesso TCS"
        className="glass relative hidden overflow-hidden p-12 text-foreground lg:flex lg:flex-col"
      >
        <Link to="/" className="flex items-center gap-3">
          <TcsMark decorative />
          <span className="font-bold">TCS</span>
        </Link>
        <div className="my-auto max-w-xl">
          {asideLabel && (
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{asideLabel}</p>
          )}
          <p className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.02em]">{asideHeadline}</p>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">{asideDescription}</p>
          <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
            {asideBullets.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-success-soft" aria-hidden="true">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                </span>
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          {asideFooter}
        </p>
      </aside>

      <main id="auth-content" tabIndex={-1} className="flex min-h-screen flex-col p-4 sm:p-8">
        <div>
          <Button asChild variant="ghost">
            <Link to="/">
              <ArrowLeft /> {backLabel}
            </Link>
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">{children}</div>
      </main>
    </div>
  );
}

export function AuthLoadingCard({
  label = 'Confirmando seu acesso',
  hint = 'Estamos identificando seu papel e o destino solicitado.',
}: {
  label?: string;
  hint?: string;
}) {
  return (
    <AuthFrame
      asideLabel="Verificando acesso"
      asideHeadline="Estamos preparando o seu acesso."
      asideDescription="Aguarde alguns segundos enquanto confirmamos a sua sessão e encaminhamos você ao ambiente correto."
      asideBullets={['Acesso individual ou municipal', 'Permissões aplicadas ao seu vínculo', 'Continuidade da rota que você solicitou']}
    >
      <Card className="w-full max-w-[460px]">
        <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center" role="status">
          <Skeleton className="h-6 w-6 rounded-full" />
          <p className="font-semibold">{label}</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}
