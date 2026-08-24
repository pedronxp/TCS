import { Component, lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { CommercialPage } from '@/pages/public/CommercialPage';
import { PlansCatalogPage } from '@/pages/public/PlansCatalogPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { Skeleton } from '@/components/ui/Skeleton';

const PrivateApp = lazy(() => import('@/PrivateApp'));
const PortalApp = lazy(() => import('@/PortalApp'));

class AuthCallbackBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="grid min-h-screen place-items-center bg-background px-4 py-12">
          <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center text-card-foreground">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">TCS</p>
            <h1 className="mt-4 text-xl font-semibold">Não foi possível abrir a autenticação</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Atualize a página ou volte ao login para continuar com segurança.
            </p>
            <a
              className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-foreground"
              href={new URLSearchParams(window.location.search).get('source') === 'console' ? '/login' : '/entrar'}
            >
              Voltar ao login
            </a>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function PrivateAppFallback() {
  return <div className="grid min-h-screen place-items-center bg-background p-6" aria-live="polite"><div className="w-full max-w-sm space-y-3"><span className="sr-only">Carregando área protegida…</span><Skeleton className="h-8 w-48" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div></div>;
}

// Layout intermédio que mantém o PrivateApp (e o AuthProvider dentro dele)
// montado enquanto o usuário navega entre /login e /app/*.
// Sem esse wrapper, cada rota montaria um novo PrivateApp separado,
// destruindo o AuthProvider ao fazer o redirect de /login → /app.
function PrivateAppShell() {
  return (
    <Suspense fallback={<PrivateAppFallback />}>
      <PrivateApp />
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackBoundary><AuthCallbackPage /></AuthCallbackBoundary>} />
        <Route element={<PublicLayout />}>
          <Route index element={<CommercialPage />} />
          <Route path="/planos" element={<PlansCatalogPage />} />
        </Route>
        <Route element={<PrivateAppShell />}>
          <Route path="/login" element={<Outlet />} />
          <Route path="/app/*" element={<Outlet />} />
        </Route>
        <Route path="*" element={<Suspense fallback={<PrivateAppFallback />}><PortalApp /></Suspense>} />
      </Routes>
    </BrowserRouter>
  );
}
