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
    <div className="relative flex min-h-[100svh] min-w-0 flex-col overflow-x-hidden bg-background text-foreground">
      <a
        href="#auth-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>

      <header className="absolute inset-x-0 top-0 z-10 flex h-16 items-center justify-between px-4 sm:h-20 sm:px-8 [@media(max-height:760px)]:h-14">
        <Link to="/" className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <TcsMark decorative />
          <span className="text-sm font-bold">TCS</span>
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft aria-hidden="true" /> {backLabel}
          </Link>
        </Button>
      </header>

      <main id="auth-content" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 pb-8 pt-20 max-[480px]:items-start max-[480px]:pb-3 max-[480px]:pt-16 sm:px-6 sm:pb-10 sm:pt-24 [@media(max-height:760px)]:items-start [@media(max-height:760px)]:pb-3 [@media(max-height:760px)]:pt-14">
        <div className={compact ? 'w-full max-w-[460px]' : 'w-full max-w-[480px]'}>
          <div className="mb-4 text-center max-[480px]:hidden sm:mb-5 [@media(max-height:760px)]:hidden">
            {asideLabel && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{asideLabel}</p>}
            <p className="mt-1.5 text-balance text-lg font-semibold leading-tight tracking-[-0.02em] sm:text-xl">{asideHeadline}</p>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-5 text-muted-foreground [@media(max-height:760px)]:hidden">{asideDescription}</p>
          </div>
          {children}
          <div className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11px] leading-5 text-muted-foreground max-[480px]:hidden [@media(max-height:760px)]:hidden">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="text-muted-foreground">{asideFooter}</span>
            <span aria-hidden="true">·</span>
            <span>{asideBullets[0]}</span>
          </div>
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
