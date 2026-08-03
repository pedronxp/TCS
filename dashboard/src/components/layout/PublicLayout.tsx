import { Link, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { TcsMark } from '@/components/brand/TcsMark';
import { CookieConsent } from '@/components/public/CookieConsent';

const publicLinks = [
  ['Produto', '/#produto'],
  ['Soluções', '/#solucoes'],
  ['Planos', '/planos'],
  ['Segurança', '/#seguranca'],
  ['Contato', '/#contato'],
] as const;

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#conteudo"
        className="sr-only z-[100] rounded-md bg-card px-4 py-2 shadow-card focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>

      <header className="relative z-40 min-h-[78px] border-b bg-card">
        <div className="mx-auto flex min-h-[78px] max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:gap-5 sm:px-8 lg:px-12 xl:px-16">
          <Link to="/" className="flex min-h-11 shrink-0 items-center gap-3" aria-label="TCS — página inicial">
            <TcsMark decorative />
            <span className="leading-none">
              <span className="block text-[15px] font-bold tracking-[-0.02em]">TCS</span>
              <span className="mt-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                Relatório e Risco
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground lg:flex" aria-label="Navegação pública">
            {publicLinks.map(([label, href]) => (
              <a key={label} href={href} className="transition-colors hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button asChild variant="outline" className="h-[46px] px-5">
              <Link to="/entrar">Entrar</Link>
            </Button>
            <Button asChild className="hidden h-[46px] px-5 sm:inline-flex">
              <a href="mailto:comercial@tcs.app?subject=Solicitação%20de%20demonstração">
                Solicitar demonstração
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-[22px] text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 xl:px-16">
          <p>© {new Date().getFullYear()} TCS</p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Links institucionais">
            <a href="/#seguranca" className="inline-flex min-h-11 items-center hover:text-foreground">Segurança</a>
            <a href="mailto:privacidade@tcs.app" className="inline-flex min-h-11 items-center hover:text-foreground">Privacidade</a>
            <a href="mailto:contato@tcs.app" className="inline-flex min-h-11 items-center hover:text-foreground">Contato</a>
            <Link to="/login" className="inline-flex min-h-11 items-center hover:text-foreground">Console TCS</Link>
          </nav>
        </div>
      </footer>
      <CookieConsent />
    </div>
  );
}
