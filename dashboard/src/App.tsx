import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardHome } from '@/pages/DashboardHome';
import { UsuariosPage } from '@/pages/UsuariosPage';
import { OcorrenciasPage } from '@/pages/OcorrenciasPage';
import { AgendamentosPage } from '@/pages/AgendamentosPage';
import { MapaPage } from '@/pages/MapaPage';
import { LaudosPage } from '@/pages/LaudosPage';
import { RelatoriosPage } from '@/pages/RelatoriosPage';
import { ArquivamentoPage } from '@/pages/ArquivamentoPage';
import { BuildsPage } from '@/pages/BuildsPage';
import { ConfiguracoesPage } from '@/pages/ConfiguracoesPage';
import { PlansPage } from '@/pages/PlansPage';
import { OrganizationsPage } from '@/pages/OrganizationsPage';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { SupportPage } from '@/pages/SupportPage';
import { CommercialMetricsPage } from '@/pages/CommercialMetricsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  const commercialDemo = import.meta.env.DEV
    && window.location.pathname === '/planos'
    && new URLSearchParams(window.location.search).get('demo') === '1';

  if (commercialDemo) {
    return <div className="min-h-screen bg-slate-50 px-4 py-6 lg:px-8"><PlansPage demo /></div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardHome />} />
              <Route path="ocorrencias" element={<OcorrenciasPage />} />
              <Route
                path="usuarios"
                element={
                  <ProtectedRoute requireRole={['master_admin', 'admin']}>
                    <UsuariosPage />
                  </ProtectedRoute>
                }
              />
              <Route path="agendamentos" element={<AgendamentosPage />} />
              <Route path="mapa" element={<MapaPage />} />
              <Route path="laudos" element={<LaudosPage />} />
              <Route path="relatorios" element={<RelatoriosPage />} />
              <Route path="planos" element={<PlansPage />} />
              <Route path="organizacoes" element={<OrganizationsPage />} />
              <Route path="assinaturas" element={<SubscriptionsPage />} />
              <Route path="sessoes" element={<SessionsPage />} />
              <Route path="suporte" element={<SupportPage />} />
              <Route path="indicadores-comerciais" element={<CommercialMetricsPage />} />
              <Route
                path="arquivamento"
                element={
                  <ProtectedRoute requireRole={['master_admin']}>
                    <ArquivamentoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="builds"
                element={
                  <ProtectedRoute requireRole={['master_admin']}>
                    <BuildsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="configuracoes"
                element={
                  <ProtectedRoute requireRole={['master_admin']}>
                    <ConfiguracoesPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
