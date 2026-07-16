import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardHome } from '@/pages/DashboardHome';
import { ArquivamentoPage } from '@/pages/ArquivamentoPage';
import { BuildsPage } from '@/pages/BuildsPage';
import { ConfiguracoesPage } from '@/pages/ConfiguracoesPage';
import { PlansPage } from '@/pages/PlansPage';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { SupportPage } from '@/pages/SupportPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { TechnicalEventsPage } from '@/pages/TechnicalEventsPage';
import { AuditPage } from '@/pages/AuditPage';
import { VersionsPage } from '@/pages/VersionsPage';
import { FormsPage } from '@/pages/FormsPage';
import { RiskRulesPage } from '@/pages/RiskRulesPage';
import { StaffPage } from '@/pages/StaffPage';

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
              <Route path="clientes" element={<CustomersPage />} />
              <Route path="clientes/:customerId/:section?" element={<CustomerDetailPage />} />
              <Route path="planos" element={<ProtectedRoute requirePermission="commercial.read"><PlansPage /></ProtectedRoute>} />
              <Route path="assinaturas" element={<ProtectedRoute requirePermission="commercial.read"><SubscriptionsPage /></ProtectedRoute>} />
              <Route path="sessoes" element={<SessionsPage />} />
              <Route path="suporte" element={<SupportPage />} />
              <Route path="staff" element={<ProtectedRoute requirePermission="staff.read"><StaffPage /></ProtectedRoute>} />
              <Route path="auditoria" element={<ProtectedRoute requirePermission="audit.read"><AuditPage /></ProtectedRoute>} />
              <Route path="desenvolvimento/versoes" element={<ProtectedRoute requirePermission="technical.read"><VersionsPage /></ProtectedRoute>} />
              <Route path="desenvolvimento/builds" element={<ProtectedRoute requirePermission="build.request"><BuildsPage /></ProtectedRoute>} />
              <Route path="desenvolvimento/formularios" element={<ProtectedRoute requirePermission="technical.read"><FormsPage /></ProtectedRoute>} />
              <Route path="desenvolvimento/regras-risco" element={<ProtectedRoute requirePermission="technical.read"><RiskRulesPage /></ProtectedRoute>} />
              <Route path="desenvolvimento/sincronizacao" element={<TechnicalEventsPage category="sync" title="Sincronização" />} />
              <Route path="desenvolvimento/armazenamento" element={<TechnicalEventsPage category="storage" title="Armazenamento" />} />
              <Route path="desenvolvimento/logs" element={<TechnicalEventsPage title="Logs e erros" />} />
              <Route path="governanca/configuracoes" element={<ProtectedRoute requirePermission="configuration.publish"><ConfiguracoesPage /></ProtectedRoute>} />
              <Route path="governanca/arquivamento" element={<ProtectedRoute requirePermission="configuration.publish"><ArquivamentoPage /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
