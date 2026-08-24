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
  compact?: boolean;
  children: ReactNode;
}

export function AuthFrame({
  asideLabel,
  asideHeadline,
  asideDescription,
  asideBullets,
  asideFooter = 'Sessão protegida e acesso conforme seu papel',
  backLabel = 'Voltar ao site',
  compact = false,
  children,
}: AuthFrameProps) {
  return (
    <div className={compact
      ? 'grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.68fr)] xl:grid-cols-[minmax(0,1fr)_minmax(460px,0.62fr)]'
      : 'grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(460px,0.72fr)]'}>
      <a
        href="#auth-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>

      <aside
        aria-label="Apresentação de acesso TCS"
        className={`glass relative hidden overflow-hidden text-foreground lg:flex lg:flex-col ${compact ? 'p-8 xl:p-10' : 'p-12'}`}
      >
        <Link to="/" className="flex items-center gap-3">
          <TcsMark decorative />
          <span className="font-bold">TCS</span>
        </Link>
        <div className={`my-auto max-w-xl ${compact ? 'py-6' : ''}`}>
          {asideLabel && (
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{asideLabel}</p>
          )}
          <p className={compact
            ? 'mt-4 max-w-[560px] text-[30px] font-semibold leading-[1.18] tracking-[-0.02em] xl:text-[34px]'
            : 'mt-5 text-4xl font-semibold leading-tight tracking-[-0.02em]'}>
            {asideHeadline}
          </p>
          <p className={compact
            ? 'mt-4 max-w-lg text-[14px] leading-6 text-muted-foreground'
            : 'mt-5 max-w-lg text-base leading-7 text-muted-foreground'}>
            {asideDescription}
          </p>
          <ul className={compact
            ? 'mt-6 space-y-3 text-[13px] text-muted-foreground'
            : 'mt-8 space-y-4 text-sm text-muted-foreground'}>
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

      <main
        id="auth-content"
        tabIndex={-1}
        className={`flex min-h-screen min-w-0 flex-col ${compact ? 'p-4 sm:p-6 lg:p-6' : 'p-4 sm:p-8'}`}
      >
        <div>
          <Button asChild variant="ghost">
            <Link to="/">
              <ArrowLeft /> {backLabel}
            </Link>
          </Button>
        </div>
        <div className={`flex flex-1 justify-center ${compact ? 'items-start py-4 lg:items-center lg:py-2' : 'items-center py-8'}`}>
          {children}
        </div>
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
