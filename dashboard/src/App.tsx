import { lazy, Suspense } from 'react';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { CommercialPage } from '@/pages/public/CommercialPage';
import { PlansCatalogPage } from '@/pages/public/PlansCatalogPage';
import { Skeleton } from '@/components/ui/Skeleton';

const PrivateApp = lazy(() => import('@/PrivateApp'));
const PortalApp = lazy(() => import('@/PortalApp'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })));

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
        <Route path="/auth/callback" element={<Suspense fallback={<PrivateAppFallback />}><AuthCallbackPage /></Suspense>} />
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
