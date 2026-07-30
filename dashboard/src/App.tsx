import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { CommercialPage } from '@/pages/public/CommercialPage';
import { PlansCatalogPage } from '@/pages/public/PlansCatalogPage';
import { Skeleton } from '@/components/ui/Skeleton';

const PrivateApp = lazy(() => import('@/PrivateApp'));
const PortalApp = lazy(() => import('@/PortalApp'));

function PrivateAppFallback() {
  return <div className="grid min-h-screen place-items-center bg-background p-6" aria-live="polite"><div className="w-full max-w-sm space-y-3"><span className="sr-only">Carregando área protegida…</span><Skeleton className="h-8 w-48" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div></div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<CommercialPage />} />
          <Route path="/planos" element={<PlansCatalogPage />} />
        </Route>
        <Route path="/login" element={<Suspense fallback={<PrivateAppFallback />}><PrivateApp /></Suspense>} />
        <Route path="/app/*" element={<Suspense fallback={<PrivateAppFallback />}><PrivateApp /></Suspense>} />
        <Route path="*" element={<Suspense fallback={<PrivateAppFallback />}><PortalApp /></Suspense>} />
      </Routes>
    </BrowserRouter>
  );
}
